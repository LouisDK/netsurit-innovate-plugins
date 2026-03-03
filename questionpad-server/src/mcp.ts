import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { SessionStore } from './store.js';

const CardSchema = z.object({
  id: z.string(),
  type: z.enum([
    'multiple-choice',
    'multi-select',
    'yes-no',
    'approve-reject',
    'free-text',
    'rating',
    'slider',
    'range-slider',
  ]),
  title: z.string(),
  body: z.string().optional(),
  required: z.boolean().optional(),
  options: z.array(z.string()).optional(),
  min: z.number().optional(),
  max: z.number().optional(),
  step: z.number().optional(),
  placeholder: z.string().optional(),
});

const ParticipantSchema = z.object({
  label: z.string(),
  cards: z.array(CardSchema),
});

function text(obj: unknown): [{ type: 'text'; text: string }] {
  return [{ type: 'text', text: JSON.stringify(obj) }];
}

export function createMcpServer(store: SessionStore, baseUrl: string): McpServer {
  const server = new McpServer({
    name: 'questionpad-server',
    version: '0.2.0',
  });

  // 1. create_session
  server.registerTool(
    'create_session',
    {
      description: 'Create a new QuestionPad session with one or more participants.',
      inputSchema: {
        agentId: z.string().optional(),
        title: z.string(),
        participants: z.array(ParticipantSchema).min(1),
      },
    },
    (args) => {
      const result = store.createSession({
        agentId: args.agentId,
        title: args.title,
        participants: args.participants,
      });
      const sessions = result.sessions.map(s => ({
        label: s.label,
        guid: s.guid,
        url: `${baseUrl}/session/${s.guid}`,
      }));
      return { content: text({ agentId: result.agentId, sessions }) };
    },
  );

  // 2. get_sessions
  server.registerTool(
    'get_sessions',
    {
      description: 'Get the current status and answers for sessions. Returns all sessions for the agent, or a filtered subset.',
      inputSchema: {
        agentId: z.string(),
        guids: z.array(z.string()).optional(),
      },
    },
    (args) => {
      const sessions = store.getSessions(args.agentId, args.guids);
      const result = sessions.map(s => ({
        guid: s.guid,
        label: s.label,
        title: s.title,
        status: s.status,
        cards: s.cards,
        answers: s.answers,
        submittedAt: s.submittedAt,
        globalComment: s.globalComment,
      }));
      return { content: text(result) };
    },
  );

  // 3. update_session
  server.registerTool(
    'update_session',
    {
      description: 'Update the cards of an existing session.',
      inputSchema: {
        agentId: z.string(),
        guid: z.string(),
        cards: z.array(CardSchema),
      },
    },
    (args) => {
      const ok = store.updateCards(args.agentId, args.guid, args.cards);
      if (!ok) {
        return {
          isError: true,
          content: text({ error: 'Session not found or cannot be updated' }),
        };
      }
      return { content: text({ success: true }) };
    },
  );

  // 4. close_sessions
  server.registerTool(
    'close_sessions',
    {
      description: 'Close sessions and retrieve the final answers. Closes all sessions for the agent, or a filtered subset.',
      inputSchema: {
        agentId: z.string(),
        guids: z.array(z.string()).optional(),
      },
    },
    (args) => {
      const results = store.closeSessions(args.agentId, args.guids);
      return { content: text(results) };
    },
  );

  return server;
}
