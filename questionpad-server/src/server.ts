import { createMcpExpressApp } from '@modelcontextprotocol/sdk/server/express.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import express from 'express';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { SessionStore } from './store.js';
import { createMcpServer } from './mcp.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = parseInt(process.env.PORT ?? '3000', 10);
const TTL_MINUTES = parseInt(process.env.TTL_MINUTES ?? '60', 10);
const BASE_URL = process.env.BASE_URL ?? `http://localhost:${PORT}`;

const store = new SessionStore(TTL_MINUTES);

// Purge expired sessions every 60 seconds
setInterval(() => store.purgeExpired(), 60_000);

const app = createMcpExpressApp({ host: '0.0.0.0' });

// JSON middleware for API routes
app.use(express.json());

// POST /mcp — stateless MCP handler (fresh McpServer + transport per request)
app.post('/mcp', async (req, res) => {
  const mcpServer = createMcpServer(store, BASE_URL);
  const transport = new StreamableHTTPServerTransport({
    sessionIdGenerator: undefined, // stateless
  });

  res.on('close', () => {
    transport.close().catch(() => {});
    mcpServer.close().catch(() => {});
  });

  await mcpServer.connect(transport);
  await transport.handleRequest(req, res, req.body);
});

// GET /session/:guid — serve the SPA if session exists
app.get('/session/:guid', (req, res) => {
  const session = store.getSessionPublic(req.params.guid);
  if (!session) {
    res.status(404).json({ error: 'Session not found' });
    return;
  }
  const htmlPath = path.join(__dirname, '..', 'public', 'app.html');
  res.sendFile(htmlPath);
});

// GET /api/sessions/:guid — return session data for the browser app
app.get('/api/sessions/:guid', (req, res) => {
  const session = store.getSessionPublic(req.params.guid);
  if (!session) {
    res.status(404).json({ error: 'Session not found' });
    return;
  }
  res.json({
    title: session.title,
    cards: session.cards,
    answers: session.answers,
    status: session.status,
    cardVersion: session.cardVersion,
  });
});

// POST /api/sessions/:guid/answers — submit a single answer
app.post('/api/sessions/:guid/answers', (req, res) => {
  const { cardId, value, comment } = req.body as {
    cardId: string;
    value: unknown;
    comment?: string;
  };
  const ok = store.submitAnswer(req.params.guid, { cardId, value, comment });
  if (!ok) {
    res.status(404).json({ error: 'Session not found or already closed' });
    return;
  }
  res.json({ success: true });
});

// POST /api/sessions/:guid/submit — submit the whole session
app.post('/api/sessions/:guid/submit', (req, res) => {
  const { globalComment } = req.body as { globalComment?: string };
  const ok = store.submitSession(req.params.guid, globalComment);
  if (!ok) {
    res.status(404).json({ error: 'Session not found or already closed' });
    return;
  }
  res.json({ success: true });
});

app.listen(PORT, () => {
  console.log(`QuestionPad server listening on port ${PORT}`);
  console.log(`Base URL: ${BASE_URL}`);
});
