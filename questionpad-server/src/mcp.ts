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

function text(obj: unknown): [{ type: 'text'; text: string }] {
  return [{ type: 'text', text: JSON.stringify(obj) }];
}

export function createMcpServer(store: SessionStore, baseUrl: string): McpServer {
  const server = new McpServer({
    name: 'questionpad-server',
    version: '0.1.0',
  });

  // 1. create_session
  server.registerTool(
    'create_session',
    {
      description: 'Create a new QuestionPad session with a set of cards.',
      inputSchema: {
        agentId: z.string().optional(),
        title: z.string(),
        cards: z.array(CardSchema),
      },
    },
    (args) => {
      const { guid, agentId } = store.createSession({
        agentId: args.agentId,
        title: args.title,
        cards: args.cards,
      });
      const url = `${baseUrl}/session/${guid}`;
      return { content: text({ guid, url, agentId }) };
    },
  );

  // 2. get_session_status
  server.registerTool(
    'get_session_status',
    {
      description: 'Get the current status and answers for a session.',
      inputSchema: {
        agentId: z.string(),
        guid: z.string(),
      },
    },
    (args) => {
      const session = store.getSession(args.agentId, args.guid);
      if (!session) {
        return {
          isError: true,
          content: text({ error: 'Session not found' }),
        };
      }
      return {
        content: text({
          status: session.status,
          title: session.title,
          cards: session.cards,
          answers: session.answers,
          submittedAt: session.submittedAt,
          globalComment: session.globalComment,
        }),
      };
    },
  );

  // 3. get_all_sessions
  server.registerTool(
    'get_all_sessions',
    {
      description: 'Get all sessions for a given agent.',
      inputSchema: {
        agentId: z.string(),
      },
    },
    (args) => {
      const sessions = store.getAllSessions(args.agentId);
      const result = sessions.map((s) => ({
        guid: s.guid,
        title: s.title,
        status: s.status,
        answers: s.answers,
        submittedAt: s.submittedAt,
        globalComment: s.globalComment,
      }));
      return { content: text(result) };
    },
  );

  // 4. update_session
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

  // 5. close_session
  server.registerTool(
    'close_session',
    {
      description: 'Close a session and retrieve the final answers.',
      inputSchema: {
        agentId: z.string(),
        guid: z.string(),
      },
    },
    (args) => {
      const result = store.closeSession(args.agentId, args.guid);
      if (!result) {
        return {
          isError: true,
          content: text({ error: 'Session not found' }),
        };
      }
      return {
        content: text({
          finalAnswers: result.finalAnswers,
          globalComment: result.globalComment,
          submittedAt: result.submittedAt,
        }),
      };
    },
  );

  return server;
}
