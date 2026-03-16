/**
 * Blob Storage Proxy Service Template
 *
 * This is a reference template. Copy to apps/orchestrator/src/services/blob-service.ts
 * and adapt container names, error handling, and validation to your application.
 *
 * Implements the mandatory orchestrator-proxied blob access pattern:
 * browser → orchestrator API → Azure Blob Storage
 *
 * This eliminates CORS complexity, enforces server-side auth, and keeps
 * blob credentials out of frontend code.
 *
 * Deviation option: SAS tokens with short TTL (< 15 minutes) for high-volume
 * download scenarios. Requires DEV-NNN registration.
 *
 * See implementation-defaults.md for the full blob access specification.
 */

import {
  BlobServiceClient,
  ContainerClient,
} from '@azure/storage-blob';
import { getConfig } from '../lib/config';
import type { Readable } from 'node:stream';

let blobServiceClient: BlobServiceClient | null = null;

function getClient(): BlobServiceClient {
  if (blobServiceClient) return blobServiceClient;

  const config = getConfig();

  // Prefer connection string; fall back to managed identity in production
  if (config.azureStorage.connectionString) {
    blobServiceClient = BlobServiceClient.fromConnectionString(
      config.azureStorage.connectionString,
    );
  } else {
    // For managed identity, use DefaultAzureCredential:
    // import { DefaultAzureCredential } from '@azure/identity';
    // blobServiceClient = new BlobServiceClient(
    //   `https://${storageAccountName}.blob.core.windows.net`,
    //   new DefaultAzureCredential(),
    // );
    throw new Error('AZURE_STORAGE_CONNECTION_STRING is required');
  }

  return blobServiceClient;
}

function getContainer(containerName: string): ContainerClient {
  return getClient().getContainerClient(containerName);
}

/**
 * Upload a blob via the orchestrator proxy.
 */
export async function upload(
  containerName: string,
  blobName: string,
  stream: Readable,
  contentType: string,
  contentLength: number,
): Promise<void> {
  const container = getContainer(containerName);
  const blockBlob = container.getBlockBlobClient(blobName);

  await blockBlob.uploadStream(stream, undefined, undefined, {
    blobHTTPHeaders: { blobContentType: contentType },
  });
}

/**
 * Download a blob via the orchestrator proxy.
 * Returns the readable stream and content metadata.
 */
export async function download(
  containerName: string,
  blobName: string,
): Promise<{
  stream: NodeJS.ReadableStream;
  contentType: string | undefined;
  contentLength: number | undefined;
}> {
  const container = getContainer(containerName);
  const blockBlob = container.getBlockBlobClient(blobName);

  const response = await blockBlob.download(0);

  if (!response.readableStreamBody) {
    throw new Error('Blob download returned no readable stream');
  }

  return {
    stream: response.readableStreamBody,
    contentType: response.contentType,
    contentLength: response.contentLength,
  };
}

/**
 * Delete a blob via the orchestrator proxy.
 */
export async function deleteBlobItem(
  containerName: string,
  blobName: string,
): Promise<void> {
  const container = getContainer(containerName);
  const blockBlob = container.getBlockBlobClient(blobName);

  await blockBlob.deleteIfExists({ deleteSnapshots: 'include' });
}

// ============================================================================
// Usage Examples
// ============================================================================
/*
// In a route handler — upload:
import * as blobService from '../services/blob-service';

fastify.post('/api/files', { preHandler: requireAuth }, async (request, reply) => {
  const file = await request.file(); // @fastify/multipart
  await blobService.upload('uploads', file.filename, file.file, file.mimetype, file.file.bytesRead);
  return reply.code(201).send({ data: { filename: file.filename }, failed: false });
});

// In a route handler — download (streaming proxy):
fastify.get('/api/files/:name', { preHandler: requireAuth }, async (request, reply) => {
  const { stream, contentType, contentLength } = await blobService.download('uploads', request.params.name);
  reply.header('content-type', contentType || 'application/octet-stream');
  if (contentLength) reply.header('content-length', contentLength);
  return reply.send(stream);
});

// SAS token deviation (requires DEV-NNN registration):
// For high-volume downloads, generate short-lived SAS tokens server-side
// and return the URL to the client. SAS TTL should be < 15 minutes.
*/
