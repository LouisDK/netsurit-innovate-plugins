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

// JSON middleware for API routes only (skip /mcp — the MCP transport handles its own body parsing)
app.use('/api', express.json());

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

// GET /hub — serve the hub page (no session validation)
app.get('/hub', (req, res) => {
  const htmlPath = path.join(__dirname, '..', 'public', 'app.html');
  res.sendFile(htmlPath);
});

// GET /session/:guid — serve the SPA (hub JS validates via API)
app.get('/session/:guid', (req, res) => {
  const htmlPath = path.join(__dirname, '..', 'public', 'app.html');
  res.sendFile(htmlPath);
});

// GET /api/sessions/:guid — return session data for the browser app (no answers — those come via join)
app.get('/api/sessions/:guid', (req, res) => {
  const session = store.getSessionPublic(req.params.guid);
  if (!session) {
    res.status(404).json({ error: 'Session not found' });
    return;
  }
  res.json({
    label: session.label,
    title: session.title,
    description: session.description,
    cards: session.cards,
    status: session.status,
    cardVersion: session.cardVersion,
  });
});

// POST /api/sessions/:guid/join — join a shared session by name
app.post('/api/sessions/:guid/join', (req, res) => {
  const { name } = req.body as { name?: string };
  if (!name || typeof name !== 'string' || name.trim() === '') {
    res.status(400).json({ error: 'Name is required' });
    return;
  }
  const result = store.joinSession(req.params.guid, name.trim());
  if (!result) {
    res.status(404).json({ error: 'Session not found or already closed' });
    return;
  }
  res.json(result);
});

// POST /api/sessions/:guid/answers — submit a single answer for a respondent
app.post('/api/sessions/:guid/answers', (req, res) => {
  const { respondentId, cardId, value, comment } = req.body as {
    respondentId: string;
    cardId: string;
    value: unknown;
    comment?: string;
  };
  const ok = store.submitAnswer(req.params.guid, respondentId, { cardId, value, comment });
  if (!ok) {
    res.status(404).json({ error: 'Session not found, respondent not found, or already closed/submitted' });
    return;
  }
  res.json({ success: true });
});

// POST /api/sessions/:guid/submit — submit for a respondent
app.post('/api/sessions/:guid/submit', (req, res) => {
  const { respondentId, globalComment } = req.body as { respondentId: string; globalComment?: string };
  const ok = store.submitRespondent(req.params.guid, respondentId, globalComment);
  if (!ok) {
    res.status(404).json({ error: 'Session not found, respondent not found, or already closed' });
    return;
  }
  res.json({ success: true });
});

// Health check for Azure Container Apps liveness probe
app.get('/health', (_req, res) => {
  res.json({ status: 'ok' });
});

app.listen(PORT, () => {
  console.log(`QuestionPad server listening on port ${PORT}`);
  console.log(`Base URL: ${BASE_URL}`);
});
