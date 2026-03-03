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
  body: z.string().optional().describe('Optional longer description shown below the title.'),
  required: z.boolean().optional().describe('If true, the participant must answer this card before submitting. Defaults to false.'),
  options: z.array(z.string()).optional().describe('Answer choices. Required for multiple-choice and multi-select card types.'),
  min: z.number().optional().describe('Minimum value. Required for rating, slider, and range-slider card types.'),
  max: z.number().optional().describe('Maximum value. Required for rating, slider, and range-slider card types.'),
  step: z.number().optional().describe('Step increment for slider and range-slider. Defaults to 1.'),
  placeholder: z.string().optional().describe('Placeholder text for free-text cards.'),
});

const ParticipantSchema = z.object({
  label: z.string().describe('Participant name or identifier (e.g. "Alice", "Bob"). Shown in the browser UI and returned with answers so you can match responses to people.'),
  cards: z.array(CardSchema).describe('The question cards for this participant. Each participant can have a different set of cards.'),
});

function text(obj: unknown): [{ type: 'text'; text: string }] {
  return [{ type: 'text', text: JSON.stringify(obj) }];
}

export function createMcpServer(store: SessionStore, baseUrl: string): McpServer {
  const server = new McpServer({
    name: 'QuestionPad',
    version: '0.2.0',
    description:
      'Collect structured feedback from humans via interactive web forms. ' +
      'Use QuestionPad when you need to ask people questions and get their answers — ' +
      'for example, gathering meeting feedback, running polls, or collecting approvals.\n\n' +
      'Workflow:\n' +
      '1. Call create_session with a title and one or more participants, each with their own question cards.\n' +
      '2. Share the returned URL(s) with participants — each person gets a unique link to their form.\n' +
      '3. Poll with get_sessions to check whether participants have answered (look for status "submitted").\n' +
      '4. When done, call close_sessions to lock the sessions and retrieve final answers.\n\n' +
      'The agentId returned by create_session is your ownership token — save it and pass it to all subsequent calls. ' +
      'It ensures your sessions are isolated from other agents using the same server.',
  });

  server.registerTool(
    'create_session',
    {
      title: 'Create Session',
      description:
        'Create a feedback session with one or more participants. Each participant gets their own URL ' +
        'with a personalized set of question cards.\n\n' +
        'Returns an agentId (save this — you need it for all other calls) and a list of sessions, ' +
        'each with a label, guid, and URL to share with the participant.\n\n' +
        'Example: To ask Alice to rate a feature and ask Bob a yes/no question, create one session ' +
        'with two participants, each having their own cards.',
      inputSchema: {
        agentId: z.string().optional().describe(
          'Your agent identifier. Omit on first call — one will be generated and returned. ' +
          'Pass the same agentId to subsequent create_session calls to group sessions under the same agent.'
        ),
        title: z.string().describe('Session title shown at the top of the form (e.g. "Sprint Retrospective", "Design Review").'),
        participants: z.array(ParticipantSchema).min(1).describe('One or more participants, each with their own label and question cards.'),
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

  server.registerTool(
    'get_sessions',
    {
      title: 'Get Sessions',
      description:
        'Poll for participant answers. Returns the current status and any submitted answers for your sessions.\n\n' +
        'Pass guids to check specific sessions, or omit to get all sessions for your agentId.\n\n' +
        'Session status lifecycle: "created" → "in_progress" (participant opened the form) → "submitted" (participant clicked submit). ' +
        'A session becomes "closed" after you call close_sessions, or "expired" if it times out.\n\n' +
        'Each answer has a cardId matching the card\'s id, a value (shape depends on card type — see create_session), ' +
        'and an optional comment. The globalComment is a free-text field the participant can fill in at the bottom of the form.',
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
        answers: s.answers,
        submittedAt: s.submittedAt,
        globalComment: s.globalComment,
      }));
      return { content: text(result) };
    },
  );

  server.registerTool(
    'update_session',
    {
      title: 'Update Session',
      description:
        'Replace the question cards on a session that hasn\'t been submitted yet. ' +
        'Use this to add follow-up questions, correct mistakes, or adapt cards based on earlier answers from other participants.\n\n' +
        'The participant\'s browser will automatically pick up the new cards within a few seconds. ' +
        'Any previously submitted answers for removed cards are discarded.',
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
        'Close sessions and retrieve the final answers. Closed sessions are locked — ' +
        'participants can no longer submit or change answers, and the form shows a "Session Ended" message.\n\n' +
        'Pass guids to close specific sessions, or omit to close all sessions for your agentId. ' +
        'Returns the final answers for each closed session, including the participant label, answers, and globalComment.',
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
