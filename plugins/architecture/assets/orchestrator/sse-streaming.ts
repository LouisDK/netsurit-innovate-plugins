/**
 * Server-Sent Events (SSE) Streaming Template for Fastify
 *
 * This is a reference template. Copy to apps/orchestrator/src/sse-streaming.ts
 * and adapt event types and handler logic to your application.
 *
 * Features:
 * - SSEWriter class with proper headers and buffering control
 * - Typed event model for AI streaming and progress updates
 * - createSSEHandler factory with error handling and cleanup
 * - Client-side React hook example in block comment
 */

import { FastifyRequest, FastifyReply } from 'fastify';

// ============================================================================
// SSE Event Types
// ============================================================================

export type SSEEventType =
  | 'text_delta'
  | 'tool_start'
  | 'tool_result'
  | 'message_complete'
  | 'progress'
  | 'error';

export interface SSEEvent {
  event: SSEEventType;
  data: Record<string, unknown>;
  id?: string;
}

// ============================================================================
// SSEWriter
// ============================================================================

export class SSEWriter {
  private reply: FastifyReply;
  private closed = false;

  constructor(reply: FastifyReply) {
    this.reply = reply;
  }

  /**
   * Send SSE headers and begin the stream.
   * Must be called before send().
   */
  start(): void {
    this.reply.raw.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no', // Disable nginx/proxy buffering
    });
  }

  /**
   * Send a typed SSE event.
   */
  send(event: SSEEvent): void {
    if (this.closed) return;

    let message = '';
    if (event.id) message += `id: ${event.id}\n`;
    message += `event: ${event.event}\n`;
    message += `data: ${JSON.stringify(event.data)}\n\n`;

    this.reply.raw.write(message);
  }

  /**
   * Send a text_delta event (convenience for AI streaming).
   */
  sendTextDelta(text: string): void {
    this.send({ event: 'text_delta', data: { text } });
  }

  /**
   * Send a progress event.
   */
  sendProgress(percent: number, message?: string): void {
    this.send({ event: 'progress', data: { percent, message } });
  }

  /**
   * End the stream.
   */
  end(): void {
    if (this.closed) return;
    this.closed = true;
    this.reply.raw.end();
  }

  get isClosed(): boolean {
    return this.closed;
  }
}

// ============================================================================
// SSE Handler Factory
// ============================================================================

type SSEHandlerFn = (
  request: FastifyRequest,
  writer: SSEWriter,
) => Promise<void>;

/**
 * Create a Fastify route handler that sets up SSE streaming.
 * Handles errors and cleanup automatically.
 *
 * Usage:
 *   app.get('/api/stream', createSSEHandler(async (request, writer) => {
 *     writer.sendTextDelta('Hello ');
 *     writer.sendTextDelta('world!');
 *     writer.send({ event: 'message_complete', data: {} });
 *   }));
 */
export function createSSEHandler(handler: SSEHandlerFn) {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    const writer = new SSEWriter(reply);
    writer.start();

    // Clean up if client disconnects
    request.raw.on('close', () => {
      writer.end();
    });

    try {
      await handler(request, writer);
    } catch (error) {
      if (!writer.isClosed) {
        writer.send({
          event: 'error',
          data: {
            message:
              error instanceof Error ? error.message : 'Internal server error',
          },
        });
      }
      request.log.error(error, 'SSE handler error');
    } finally {
      writer.end();
    }
  };
}

// ============================================================================
// Usage Examples
// ============================================================================
/*
// Fastify route using SSE:
import { createSSEHandler } from './sse-streaming';
import { requireAuth } from './auth-middleware';

app.get(
  '/api/chat/stream',
  { preHandler: [requireAuth] },
  createSSEHandler(async (request, writer) => {
    const { prompt } = request.query as { prompt: string };

    // Stream AI response
    writer.sendProgress(0, 'Starting...');

    for await (const chunk of aiProvider.stream(prompt)) {
      if (writer.isClosed) break; // Client disconnected
      writer.sendTextDelta(chunk.text);
    }

    writer.send({ event: 'message_complete', data: { tokensUsed: 150 } });
  }),
);
*/

// ============================================================================
// Client-Side React Hook Example
// ============================================================================
/*
// apps/web/src/hooks/useSSE.ts

import { useState, useCallback } from 'react';

interface UseSSEOptions {
  onTextDelta?: (text: string) => void;
  onProgress?: (percent: number, message?: string) => void;
  onComplete?: (data: Record<string, unknown>) => void;
  onError?: (error: string) => void;
}

export function useSSE(options: UseSSEOptions = {}) {
  const [isStreaming, setIsStreaming] = useState(false);

  const startStream = useCallback(
    async (url: string, init?: RequestInit) => {
      setIsStreaming(true);

      try {
        const response = await fetch(url, {
          ...init,
          headers: {
            ...init?.headers,
            Accept: 'text/event-stream',
          },
        });

        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        if (!response.body) throw new Error('No response body');

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() || '';

          let currentEvent = '';
          for (const line of lines) {
            if (line.startsWith('event: ')) {
              currentEvent = line.slice(7);
            } else if (line.startsWith('data: ')) {
              const data = JSON.parse(line.slice(6));

              switch (currentEvent) {
                case 'text_delta':
                  options.onTextDelta?.(data.text);
                  break;
                case 'progress':
                  options.onProgress?.(data.percent, data.message);
                  break;
                case 'message_complete':
                  options.onComplete?.(data);
                  break;
                case 'error':
                  options.onError?.(data.message);
                  break;
              }
            }
          }
        }
      } catch (error) {
        options.onError?.(
          error instanceof Error ? error.message : 'Stream failed',
        );
      } finally {
        setIsStreaming(false);
      }
    },
    [options],
  );

  return { startStream, isStreaming };
}

// Usage in a component:
//
// function ChatPage() {
//   const [text, setText] = useState('');
//   const { startStream, isStreaming } = useSSE({
//     onTextDelta: (delta) => setText((prev) => prev + delta),
//     onComplete: () => console.log('Done!'),
//   });
//
//   return (
//     <div>
//       <button onClick={() => startStream('/api/chat/stream?prompt=hello')}>
//         {isStreaming ? 'Streaming...' : 'Start'}
//       </button>
//       <pre>{text}</pre>
//     </div>
//   );
// }
*/
