#!/usr/bin/env bash
set -euo pipefail

# =============================================================================
# This is a reference template. Copy to infra/deploy.sh in your project and
# adapt resource names, image paths, and migration logic.
# =============================================================================

# =============================================================================
# SAMPLE deploy.sh
#
# Purpose:
#   Example deployment script for the Azure Single-Tenant Application Standard.
#
# Important:
#   - This is intentionally a SAMPLE, not a drop-in production script.
#   - You MUST adapt names, resource layout, migration commands, health paths,
#     and secret/config wiring for your application.
#   - The standard architecture assumes TWO deployable services by default:
#       1) web          (Next.js)
#       2) orchestrator (Fastify / backend)
#
# Recommended usage:
#   ./infra/deploy.sh <command> [environment]
#
# Commands:
#   infra      Deploy/update Azure infrastructure via Bicep
#   build      Build & push container images
#   migrate    Run database migrations (example hook only)
#   deploy     Deploy web + orchestrator revisions
#   verify     Check health/readiness/version
#   status     Show current deployment status
#   rollback   Roll back web + orchestrator to previous revisions
#   all        infra -> build -> migrate -> deploy -> verify
#
# Environments:
#   dev (default), test, prod
#
# Notes:
#   - Uses Azure CLI + Docker
#   - Assumes Azure Container Apps + Azure Container Registry
#   - Assumes Bicep for infrastructure
#   - Assumes immutable image tags (commit SHA preferred)
# =============================================================================

COMMAND="${1:-}"
ENV="${2:-dev}"

if [[ -z "$COMMAND" ]]; then
  echo "Usage: ./infra/deploy.sh <infra|build|migrate|deploy|verify|status|rollback|all> [env]"
  exit 1
fi

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

# -----------------------------------------------------------------------------
# SAMPLE CONFIGURATION
#
# Replace these values with app-specific naming and environment logic.
# Many teams will prefer to source these from a small config file.
# -----------------------------------------------------------------------------

# Example Azure subscription and region
SUBSCRIPTION_ID="${SUBSCRIPTION_ID:-00000000-0000-0000-0000-000000000000}"
LOCATION="${LOCATION:-eastus}"

# Example naming convention
APP_SLUG="${APP_SLUG:-myapp}"
RESOURCE_GROUP="${RESOURCE_GROUP:-rg-${APP_SLUG}-${ENV}}"
CONTAINERAPPS_ENV="${CONTAINERAPPS_ENV:-cae-${APP_SLUG}-${ENV}}"
ACR_NAME="${ACR_NAME:-${APP_SLUG//-/}acr${ENV}}"

# Standard two-service model
WEB_APP_NAME="${WEB_APP_NAME:-${APP_SLUG}-web-${ENV}}"
ORCH_APP_NAME="${ORCH_APP_NAME:-${APP_SLUG}-orchestrator-${ENV}}"

# Image names inside ACR
WEB_IMAGE_NAME="${WEB_IMAGE_NAME:-${APP_SLUG}/web}"
ORCH_IMAGE_NAME="${ORCH_IMAGE_NAME:-${APP_SLUG}/orchestrator}"

# IaC inputs
BICEP_TEMPLATE="${BICEP_TEMPLATE:-${SCRIPT_DIR}/main.bicep}"
PARAM_FILE="${PARAM_FILE:-${SCRIPT_DIR}/parameters/${ENV}.bicepparam}"

# Health paths
WEB_HEALTH_PATH="${WEB_HEALTH_PATH:-/api/health}"
WEB_READY_PATH="${WEB_READY_PATH:-/api/ready}"
ORCH_HEALTH_PATH="${ORCH_HEALTH_PATH:-/api/health}"
ORCH_READY_PATH="${ORCH_READY_PATH:-/api/ready}"

# Build metadata
DEFAULT_TAG_FILE="${SCRIPT_DIR}/.last-tag"
BUILD_TAG="${BUILD_TAG:-}"

# -----------------------------------------------------------------------------
# Console helpers
# -----------------------------------------------------------------------------
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

log_info()  { echo -e "${BLUE}[INFO]${NC} $*"; }
log_ok()    { echo -e "${GREEN}[ OK ]${NC} $*"; }
log_warn()  { echo -e "${YELLOW}[WARN]${NC} $*"; }
log_error() { echo -e "${RED}[ERR ]${NC} $*"; }

az_tsv() { az "$@" | tr -d '\r'; }

require_cmd() {
  local cmd="$1"
  if ! command -v "$cmd" >/dev/null 2>&1; then
    log_error "Required command not found: $cmd"
    exit 1
  fi
}

# -----------------------------------------------------------------------------
# Common helpers
# -----------------------------------------------------------------------------

check_prereqs() {
  log_info "Checking prerequisites..."
  require_cmd az
  require_cmd docker
  require_cmd git
  require_cmd curl

  if ! az account show >/dev/null 2>&1; then
    log_error "Azure CLI is not logged in. Run: az login"
    exit 1
  fi

  az account set --subscription "$SUBSCRIPTION_ID"
  log_ok "Subscription set: $SUBSCRIPTION_ID"

  if [[ ! -f "$BICEP_TEMPLATE" ]]; then
    log_error "Bicep template not found: $BICEP_TEMPLATE"
    exit 1
  fi

  if [[ ! -f "$PARAM_FILE" ]]; then
    log_error "Parameter file not found: $PARAM_FILE"
    exit 1
  fi

  log_ok "Bicep template: $BICEP_TEMPLATE"
  log_ok "Parameter file: $PARAM_FILE"
}

ensure_resource_group() {
  if ! az group show --name "$RESOURCE_GROUP" >/dev/null 2>&1; then
    log_warn "Resource group does not exist yet: $RESOURCE_GROUP"
    log_info "Creating resource group in $LOCATION"
    az group create --name "$RESOURCE_GROUP" --location "$LOCATION" >/dev/null
    log_ok "Created resource group: $RESOURCE_GROUP"
  fi
}

get_acr_login_server() {
  az_tsv acr show \
    --name "$ACR_NAME" \
    --resource-group "$RESOURCE_GROUP" \
    --query 'loginServer' -o tsv
}

resolve_tag() {
  if [[ -n "${BUILD_TAG}" ]]; then
    echo "$BUILD_TAG"
    return 0
  fi

  if [[ -f "$DEFAULT_TAG_FILE" ]]; then
    tr -d '\r' < "$DEFAULT_TAG_FILE"
    return 0
  fi

  git rev-parse --short HEAD
}

# -----------------------------------------------------------------------------
# infra
# -----------------------------------------------------------------------------

cmd_infra() {
  log_info "Deploying infrastructure for environment: $ENV"
  ensure_resource_group

  # SAMPLE ONLY:
  # In a real implementation, prefer Key Vault references, managed identities,
  # and controlled CI/CD secret injection over interactive prompting.
  #
  # If your Bicep template needs secret parameters, inject them carefully here.
  #
  # Example:
  #   --parameters pgAdminPassword="$PG_ADMIN_PASSWORD"
  #   --parameters jwtSecret="$JWT_SECRET"

  az deployment group create \
    --resource-group "$RESOURCE_GROUP" \
    --template-file "$BICEP_TEMPLATE" \
    --parameters @"$PARAM_FILE" \
    --name "${APP_SLUG}-${ENV}-$(date +%Y%m%d-%H%M%S)"

  log_ok "Infrastructure deployment complete"

  log_info "Suggested next steps:"
  log_info "  ./infra/deploy.sh build $ENV"
  log_info "  ./infra/deploy.sh migrate $ENV"
  log_info "  ./infra/deploy.sh deploy $ENV"
  log_info "  ./infra/deploy.sh verify $ENV"
}

# -----------------------------------------------------------------------------
# build
# -----------------------------------------------------------------------------

cmd_build() {
  log_info "Building and pushing container images..."

  local tag
  tag="$(git rev-parse --short HEAD)"
  echo "$tag" > "$DEFAULT_TAG_FILE"

  local acr_server
  acr_server="$(get_acr_login_server)"

  log_info "ACR login server: $acr_server"
  az acr login --name "$ACR_NAME"

  # SAMPLE Docker build contexts.
  # Adjust these paths to match your repo layout.
  local web_context="${PROJECT_ROOT}/apps/web"
  local orch_context="${PROJECT_ROOT}/apps/orchestrator"

  if [[ ! -d "$web_context" ]]; then
    log_warn "Web context not found at $web_context"
    log_warn "Update this path for your repo structure."
  fi

  if [[ ! -d "$orch_context" ]]; then
    log_warn "Orchestrator context not found at $orch_context"
    log_warn "Update this path for your repo structure."
  fi

  log_info "Building web image: ${acr_server}/${WEB_IMAGE_NAME}:${tag}"
  docker build \
    -t "${acr_server}/${WEB_IMAGE_NAME}:${tag}" \
    -t "${acr_server}/${WEB_IMAGE_NAME}:latest" \
    "$web_context"

  log_info "Building orchestrator image: ${acr_server}/${ORCH_IMAGE_NAME}:${tag}"
  docker build \
    -t "${acr_server}/${ORCH_IMAGE_NAME}:${tag}" \
    -t "${acr_server}/${ORCH_IMAGE_NAME}:latest" \
    "$orch_context"

  log_info "Pushing images..."
  docker push "${acr_server}/${WEB_IMAGE_NAME}:${tag}"
  docker push "${acr_server}/${ORCH_IMAGE_NAME}:${tag}"

  # Convenience tags only. Do not deploy by relying exclusively on latest.
  docker push "${acr_server}/${WEB_IMAGE_NAME}:latest"
  docker push "${acr_server}/${ORCH_IMAGE_NAME}:latest"

  log_ok "Images pushed with tag: $tag"
}

# -----------------------------------------------------------------------------
# migrate
# -----------------------------------------------------------------------------

cmd_migrate() {
  log_info "Running database migrations..."

  local pg_host
  pg_host="$(az_tsv postgres flexible-server show \
    --name "${APP_SLUG}-psql-${ENV}" \
    --resource-group "$RESOURCE_GROUP" \
    --query 'fullyQualifiedDomainName' -o tsv 2>/dev/null || true)"

  if [[ -z "$pg_host" ]]; then
    log_warn "Could not determine PostgreSQL host. Skipping migration."
    return 0
  fi

  local db_url="postgresql://${PG_ADMIN_USER:-pgadmin}:${PG_ADMIN_PASSWORD}@${pg_host}:5432/${PG_DATABASE:-appdb}"

  # Add temporary firewall rule for local/CI access
  local rule_name="deploy-$(date +%s)"
  local my_ip
  my_ip="$(curl -s https://api.ipify.org || true)"

  if [[ -n "$my_ip" ]]; then
    log_info "Adding temporary firewall rule for $my_ip"
    az postgres flexible-server firewall-rule create \
      --name "$rule_name" \
      --resource-group "$RESOURCE_GROUP" \
      --server-name "${APP_SLUG}-psql-${ENV}" \
      --start-ip-address "$my_ip" \
      --end-ip-address "$my_ip" >/dev/null 2>&1 || true
  fi

  # Run migrations
  if [[ -x "${SCRIPT_DIR}/init-db.sh" ]]; then
    "${SCRIPT_DIR}/init-db.sh" "$db_url"
  else
    log_warn "init-db.sh not found or not executable at ${SCRIPT_DIR}/init-db.sh"
    log_warn "Replace cmd_migrate() with your app's migration process."
  fi

  # Remove temporary firewall rule
  if [[ -n "$my_ip" && -n "${rule_name:-}" ]]; then
    log_info "Removing temporary firewall rule"
    az postgres flexible-server firewall-rule delete \
      --name "$rule_name" \
      --resource-group "$RESOURCE_GROUP" \
      --server-name "${APP_SLUG}-psql-${ENV}" \
      --yes >/dev/null 2>&1 || true
  fi

  log_ok "Migration step complete"
}

# -----------------------------------------------------------------------------
# deploy
# -----------------------------------------------------------------------------

deploy_containerapp_image() {
  local app_name="$1"
  local full_image="$2"

  log_info "Updating Container App: $app_name"
  az containerapp update \
    --name "$app_name" \
    --resource-group "$RESOURCE_GROUP" \
    --image "$full_image" >/dev/null

  log_ok "Updated $app_name -> $full_image"
}

cmd_deploy() {
  local tag
  tag="$(resolve_tag)"

  local acr_server
  acr_server="$(get_acr_login_server)"

  log_info "Deploying tag: $tag"

  local web_image="${acr_server}/${WEB_IMAGE_NAME}:${tag}"
  local orch_image="${acr_server}/${ORCH_IMAGE_NAME}:${tag}"

  deploy_containerapp_image "$WEB_APP_NAME" "$web_image"
  deploy_containerapp_image "$ORCH_APP_NAME" "$orch_image"

  log_info "Waiting briefly for revisions to initialize..."
  sleep 8

  cmd_verify
}

# -----------------------------------------------------------------------------
# verify
# -----------------------------------------------------------------------------

show_health() {
  local label="$1"
  local url="$2"

  echo
  log_info "Checking $label"
  log_info "  $url"

  if curl -fsS "$url" >/dev/null 2>&1; then
    log_ok "$label responded successfully"
    curl -fsS "$url" || true
    echo
  else
    log_warn "$label did not return success"
  fi
}

get_containerapp_fqdn() {
  local app_name="$1"
  az_tsv containerapp show \
    --name "$app_name" \
    --resource-group "$RESOURCE_GROUP" \
    --query 'properties.configuration.ingress.fqdn' -o tsv
}

cmd_verify() {
  log_info "Verifying deployment..."

  local web_fqdn orch_fqdn
  web_fqdn="$(get_containerapp_fqdn "$WEB_APP_NAME" || true)"
  orch_fqdn="$(get_containerapp_fqdn "$ORCH_APP_NAME" || true)"

  if [[ -n "$web_fqdn" ]]; then
    show_health "web health" "https://${web_fqdn}${WEB_HEALTH_PATH}"
    show_health "web readiness" "https://${web_fqdn}${WEB_READY_PATH}"
  else
    log_warn "Could not determine web FQDN"
  fi

  if [[ -n "$orch_fqdn" ]]; then
    show_health "orchestrator health" "https://${orch_fqdn}${ORCH_HEALTH_PATH}"
    show_health "orchestrator readiness" "https://${orch_fqdn}${ORCH_READY_PATH}"
  else
    log_warn "Could not determine orchestrator FQDN"
  fi

  log_info "Verification complete"
}

# -----------------------------------------------------------------------------
# status
# -----------------------------------------------------------------------------

show_app_status() {
  local app_name="$1"
  echo
  log_info "=== Status: $app_name ==="
  az containerapp show \
    --name "$app_name" \
    --resource-group "$RESOURCE_GROUP" \
    --query '{name:name,fqdn:properties.configuration.ingress.fqdn,revision:properties.latestRevisionName,image:properties.template.containers[0].image,state:properties.provisioningState}' \
    -o table 2>/dev/null || log_warn "Could not read status for $app_name"

  echo
  az containerapp revision list \
    --name "$app_name" \
    --resource-group "$RESOURCE_GROUP" \
    --query '[].{name:name,active:properties.active,created:properties.createdTime,status:properties.runningState}' \
    -o table 2>/dev/null || log_warn "Could not list revisions for $app_name"
}

cmd_status() {
  log_info "Environment: $ENV"
  log_info "Resource Group: $RESOURCE_GROUP"
  show_app_status "$WEB_APP_NAME"
  show_app_status "$ORCH_APP_NAME"
}

# -----------------------------------------------------------------------------
# rollback
# -----------------------------------------------------------------------------

rollback_one_app() {
  local app_name="$1"

  log_info "Preparing rollback for $app_name"

  local revisions
  revisions="$(az containerapp revision list \
    --name "$app_name" \
    --resource-group "$RESOURCE_GROUP" \
    --query 'sort_by([], &properties.createdTime)[-2:].name' \
    -o tsv 2>/dev/null | tr -d '\r')"

  local count
  count="$(echo "$revisions" | sed '/^\s*$/d' | wc -l | tr -d ' ')"

  if [[ "$count" -lt 2 ]]; then
    log_warn "Not enough revisions to roll back $app_name"
    return 0
  fi

  local previous current
  previous="$(echo "$revisions" | head -1)"
  current="$(echo "$revisions" | tail -1)"

  log_info "Current revision:  $current"
  log_info "Previous revision: $previous"

  az containerapp revision activate \
    --name "$app_name" \
    --resource-group "$RESOURCE_GROUP" \
    --revision "$previous" >/dev/null

  az containerapp ingress traffic set \
    --name "$app_name" \
    --resource-group "$RESOURCE_GROUP" \
    --revision-weight "${previous}=100" >/dev/null

  az containerapp revision deactivate \
    --name "$app_name" \
    --resource-group "$RESOURCE_GROUP" \
    --revision "$current" >/dev/null

  log_ok "Rolled back $app_name -> $previous"
}

cmd_rollback() {
  log_warn "Rollback affects application revisions only."
  log_warn "It does NOT automatically reverse schema or data changes."
  rollback_one_app "$WEB_APP_NAME"
  rollback_one_app "$ORCH_APP_NAME"
  cmd_status
}

# -----------------------------------------------------------------------------
# all
# -----------------------------------------------------------------------------

cmd_all() {
  log_info "Running full deployment flow for $ENV"
  cmd_infra
  cmd_build
  cmd_migrate
  cmd_deploy
  cmd_verify
  log_ok "Full deployment flow complete"
}

# -----------------------------------------------------------------------------
# dispatch
# -----------------------------------------------------------------------------

check_prereqs

case "$COMMAND" in
  infra)    cmd_infra ;;
  build)    cmd_build ;;
  migrate)  cmd_migrate ;;
  deploy)   cmd_deploy ;;
  verify)   cmd_verify ;;
  status)   cmd_status ;;
  rollback) cmd_rollback ;;
  all)      cmd_all ;;
  *)
    log_error "Unknown command: $COMMAND"
    echo "Usage: ./infra/deploy.sh <infra|build|migrate|deploy|verify|status|rollback|all> [env]"
    exit 1
    ;;
esac