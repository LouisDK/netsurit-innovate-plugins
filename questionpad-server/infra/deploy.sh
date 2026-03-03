#!/bin/bash
# ============================================================================
# QuestionPad — Azure Container Apps Deployment Script
# Usage: ./deploy.sh [infra|build|deploy|status|all]
# ============================================================================
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

# Configuration - override with environment variables
RESOURCE_GROUP="${RESOURCE_GROUP:-rg_inx_workshops_tools}"
LOCATION="${LOCATION:-eastus2}"
BASE_NAME="${BASE_NAME:-questionpad}"
ACR_NAME="${ACR_NAME:-${BASE_NAME//[-]/}acr}"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

log_info() { echo -e "${GREEN}[INFO]${NC} $1"; }
log_warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; }

# Deploy infrastructure
deploy_infra() {
    log_info "Deploying infrastructure to $RESOURCE_GROUP..."

    if ! az account show &>/dev/null; then
        log_error "Not logged in. Run 'az login' first."
        exit 1
    fi

    if ! az group show --name "$RESOURCE_GROUP" &>/dev/null; then
        log_error "Resource group '$RESOURCE_GROUP' does not exist."
        exit 1
    fi

    log_info "Deploying Bicep template..."
    az deployment group create \
        --resource-group "$RESOURCE_GROUP" \
        --template-file "$SCRIPT_DIR/main.bicep" \
        --parameters \
            baseName="$BASE_NAME" \
            location="$LOCATION" \
        --output table

    # Print outputs
    ACR_SERVER=$(az deployment group show \
        --resource-group "$RESOURCE_GROUP" \
        --name main \
        --query properties.outputs.acrLoginServer.value -o tsv 2>/dev/null || echo "N/A")
    APP_URL=$(az deployment group show \
        --resource-group "$RESOURCE_GROUP" \
        --name main \
        --query properties.outputs.appUrl.value -o tsv 2>/dev/null || echo "N/A")

    echo ""
    log_info "Infrastructure deployed!"
    echo "  ACR Server: $ACR_SERVER"
    echo "  App URL:    $APP_URL"
    echo ""
}

# Build and push Docker image
build_image() {
    log_info "Building Docker image..."

    ACR_LOGIN_SERVER=$(az acr show --name "$ACR_NAME" --resource-group "$RESOURCE_GROUP" --query loginServer -o tsv | tr -d '\r')

    if [[ -z "$ACR_LOGIN_SERVER" ]]; then
        log_error "Could not get ACR login server"
        exit 1
    fi

    log_info "ACR: $ACR_LOGIN_SERVER"
    az acr login --name "$ACR_NAME"

    GIT_COMMIT=$(git rev-parse --short HEAD)

    log_info "Building questionpad ($GIT_COMMIT)..."
    docker build \
        -t "$ACR_LOGIN_SERVER/questionpad:$GIT_COMMIT" \
        -f "$PROJECT_ROOT/Dockerfile" \
        "$PROJECT_ROOT"

    log_info "Pushing image..."
    docker push "$ACR_LOGIN_SERVER/questionpad:$GIT_COMMIT"

    echo ""
    log_info "Image built and pushed: $ACR_LOGIN_SERVER/questionpad:$GIT_COMMIT"
    echo ""
}

# Deploy to Container App
deploy_app() {
    log_info "Updating Container App..."

    ACR_LOGIN_SERVER=$(az acr show --name "$ACR_NAME" --resource-group "$RESOURCE_GROUP" --query loginServer -o tsv | tr -d '\r')
    GIT_COMMIT=$(git rev-parse --short HEAD)

    log_info "Deploying tag: $GIT_COMMIT"

    az containerapp update \
        --name "${BASE_NAME}" \
        --resource-group "$RESOURCE_GROUP" \
        --image "$ACR_LOGIN_SERVER/questionpad:$GIT_COMMIT" \
        --revision-suffix "v${GIT_COMMIT}" \
        --output table

    APP_URL=$(az containerapp show --name "${BASE_NAME}" --resource-group "$RESOURCE_GROUP" --query properties.configuration.ingress.fqdn -o tsv 2>/dev/null || echo "Not deployed")

    echo ""
    log_info "Deployed!"
    echo "  App URL: https://$APP_URL"
    echo ""
}

# Show status
show_status() {
    log_info "Deployment status..."
    echo ""
    az containerapp show --name "${BASE_NAME}" --resource-group "$RESOURCE_GROUP" --output table 2>/dev/null || log_warn "Container App not found"
    echo ""

    APP_URL=$(az containerapp show --name "${BASE_NAME}" --resource-group "$RESOURCE_GROUP" --query properties.configuration.ingress.fqdn -o tsv 2>/dev/null || echo "Not deployed")

    echo "URL:"
    echo "  App: https://$APP_URL"
}

# Main
case "${1:-}" in
    infra)  deploy_infra ;;
    build)  build_image ;;
    deploy) deploy_app ;;
    status) show_status ;;
    all)
        deploy_infra
        build_image
        deploy_app
        ;;
    *)
        echo "Usage: $0 <command>"
        echo ""
        echo "Commands:"
        echo "  infra   - Deploy Azure infrastructure (Bicep)"
        echo "  build   - Build and push Docker image to ACR"
        echo "  deploy  - Update Container App with latest image"
        echo "  status  - Show deployment status"
        echo "  all     - Run infra, build, and deploy"
        echo ""
        exit 1
        ;;
esac
