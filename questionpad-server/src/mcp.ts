import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { SessionStore } from './store.js';

const CardSchema = z.object({
  id: z.string().describe('Unique card identifier within this participant (e.g. "q1", "q2"). Used to match answers back to cards.'),
  type: z.enum([
    'multiple-choice',
    'multi-select',
    'yes-no',
    'approve-reject',
    'free-text',
    'rating',
    'slider',
    'range-slider',
  ]).describe(
    'Card type. Determines which fields are required and the shape of the answer value:\n' +
    '- multiple-choice: requires "options". Answer: { choice: "selected option" }\n' +
    '- multi-select: requires "options". Answer: { choices: ["opt1", "opt2"] }\n' +
    '- yes-no: no extra fields. Answer: { value: true/false }\n' +
    '- approve-reject: no extra fields. Answer: { status: "approved" | "rejected" }\n' +
    '- free-text: optional "placeholder". Answer: { text: "user input" }\n' +
    '- rating: requires "min" and "max" (integers). Answer: { rating: 4 }\n' +
    '- slider: requires "min" and "max", optional "step". Answer: { value: 7.5 }\n' +
    '- range-slider: requires "min" and "max", optional "step". Answer: { value: [3, 8] }'
  ),
  title: z.string().describe('The question or prompt shown to the participant.'),
  body: z.string().optional().describe('Optional markdown text shown below the card title. Use for context, instructions, or details specific to this question.'),
  required: z.boolean().optional().describe('If true, the participant must answer this card before submitting. Defaults to false.'),
  options: z.array(z.string()).optional().describe('Answer choices. Required for multiple-choice and multi-select card types.'),
  min: z.number().optional().describe('Minimum value. Required for rating, slider, and range-slider card types.'),
  max: z.number().optional().describe('Maximum value. Required for rating, slider, and range-slider card types.'),
  step: z.number().optional().describe('Step increment for slider and range-slider. Defaults to 1.'),
  placeholder: z.string().optional().describe('Placeholder text for free-text cards.'),
});

const ParticipantSchema = z.object({
  label: z.string().describe(
    'Session label or group name (e.g. "Sales Team", "Engineering"). ' +
    'Multiple people can open the same URL for this session and each enters their name to join as a respondent.'
  ),
  cards: z.array(CardSchema).describe('The question cards for this session. All respondents who join will see the same cards.'),
});

function text(obj: unknown): [{ type: 'text'; text: string }] {
  return [{ type: 'text', text: JSON.stringify(obj) }];
}

export function createMcpServer(store: SessionStore, baseUrl: string): McpServer {
  const server = new McpServer({
    name: 'QuestionPad',
    version: '0.3.0',
    description:
      'Collect structured feedback from humans via interactive web forms. ' +
      'Use QuestionPad when you need to ask people questions and get their answers — ' +
      'for example, gathering meeting feedback, running polls, or collecting approvals.\n\n' +
      'Workflow:\n' +
      '1. Call create_session with a title and one or more participants (shared sessions), each with their own question cards.\n' +
      '2. Share the returned URL(s) — multiple people can open the same URL, enter their name, and fill in the form independently as respondents.\n' +
      '3. Poll with get_sessions to check respondent progress (each respondent has their own status and answers).\n' +
      '4. When done, call close_sessions to lock the sessions and retrieve all respondent answers.\n\n' +
      'The agentId returned by create_session is your ownership token — save it and pass it to all subsequent calls. ' +
      'It ensures your sessions are isolated from other agents using the same server.',
  });

  server.registerTool(
    'create_session',
    {
      title: 'Create Session',
      description:
        'Create a feedback session with one or more participant groups. Each group gets its own URL ' +
        'with a set of question cards. Multiple people can open the same URL, enter their name, and fill in the form independently.\n\n' +
        'Returns an agentId (save this — you need it for all other calls) and a list of sessions, ' +
        'each with a label, guid, and URL to share.\n\n' +
        'Example: To collect feedback from a sales team and an engineering team, create one session ' +
        'with two participants — label "Sales" with sales-focused cards, label "Engineering" with technical cards. ' +
        'Share each URL with the respective group.',
      inputSchema: {
        agentId: z.string().optional().describe(
          'Your agent identifier. Omit on first call — one will be generated and returned. ' +
          'Pass the same agentId to subsequent create_session calls to group sessions under the same agent.'
        ),
        title: z.string().describe('Session title shown at the top of the form (e.g. "Sprint Retrospective", "Design Review").'),
        description: z.string().optional().describe(
          'Optional markdown text displayed below the title, above the question cards. ' +
          'Use this to provide context, instructions, or background information to participants. ' +
          'Supports full markdown: headings, bold, italic, lists, code blocks, and links.'
        ),
        participants: z.array(ParticipantSchema).min(1).describe('One or more participants, each with their own label and question cards.'),
      },
    },
    (args) => {
      const result = store.createSession({
        agentId: args.agentId,
        title: args.title,
        description: args.description,
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

  server.registerTool(
    'get_sessions',
    {
      title: 'Get Sessions',
      description:
        'Poll for respondent answers. Returns the current status and respondent data for your sessions.\n\n' +
        'Pass guids to check specific sessions, or omit to get all sessions for your agentId.\n\n' +
        'Session status lifecycle: "created" → "in_progress" (first respondent joined) → "closed" (after close_sessions) or "expired" (timed out).\n\n' +
        'Each session contains a respondents array. Each respondent has a name, status ("in_progress" or "submitted"), ' +
        'answers (each with cardId, value, optional comment), and an optional globalComment.',
      inputSchema: {
        agentId: z.string().describe('Your agent identifier (returned by create_session).'),
        guids: z.array(z.string()).optional().describe(
          'Specific session GUIDs to fetch. Omit to return all sessions for this agentId.'
        ),
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
        respondents: s.respondents.map(r => ({
          name: r.name,
          status: r.status,
          answers: r.answers,
          globalComment: r.globalComment,
          submittedAt: r.submittedAt,
        })),
      }));
      return { content: text(result) };
    },
  );

  server.registerTool(
    'update_session',
    {
      title: 'Update Session',
      description:
        'Replace the question cards on a session that hasn\'t been closed yet. ' +
        'Use this to add follow-up questions, correct mistakes, or adapt cards based on earlier answers from other participants.\n\n' +
        'All respondents\' browsers will automatically pick up the new cards within a few seconds. ' +
        'Any previously submitted answers for removed cards are discarded from all respondents.',
      inputSchema: {
        agentId: z.string().describe('Your agent identifier (returned by create_session).'),
        guid: z.string().describe('The specific session GUID to update.'),
        cards: z.array(CardSchema).describe('The new set of cards, replacing all existing cards on this session.'),
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

  server.registerTool(
    'close_sessions',
    {
      title: 'Close Sessions',
      description:
        'Close sessions and retrieve the final answers from all respondents. Closed sessions are locked — ' +
        'no new respondents can join and existing respondents can no longer submit or change answers.\n\n' +
        'Pass guids to close specific sessions, or omit to close all sessions for your agentId. ' +
        'Returns each closed session with its respondents array, where each respondent includes their name, answers, globalComment, and submittedAt.',
      inputSchema: {
        agentId: z.string().describe('Your agent identifier (returned by create_session).'),
        guids: z.array(z.string()).optional().describe(
          'Specific session GUIDs to close. Omit to close all sessions for this agentId.'
        ),
      },
    },
    (args) => {
      const results = store.closeSessions(args.agentId, args.guids);
      return { content: text(results) };
    },
  );

  return server;
}
