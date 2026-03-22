# Story 40.4: ProjectChatPanel LLM Integration

Status: review

## Story

As a dashboard user with questions about my project,
I want the Project Chat panel to answer questions using an LLM with project context,
so that I get contextual, project-aware responses.

## Acceptance Criteria

1. POST /api/chat endpoint accepts a question and returns an LLM-generated answer
2. The endpoint uses `ProjectContext.fullContext` as the system prompt for the LLM
3. When no LLM API key is configured, the endpoint returns a helpful fallback message
4. ProjectChatPanel `onAskQuestion` handler calls the chat API and displays responses
5. Chat messages are displayed in order (user question → assistant answer)
6. Tests verify API route, fallback behavior, and message display

## Tasks / Subtasks

- [x] Task 1: Create chat API endpoint (AC: #1, #2, #3)
  - [x] 1.1: Create `POST /api/chat` route accepting `{ question: string }`
  - [x] 1.2: Build context via `aggregateProjectContext()` for system prompt
  - [x] 1.3: Call Anthropic Messages API with context + question
  - [x] 1.4: Return `{ answer: string }` response
  - [x] 1.5: Fallback message when ANTHROPIC_API_KEY not set
- [x] Task 2: Create useProjectChat hook (AC: #4, #5)
  - [x] 2.1: `useProjectChat()` manages ChatMessage[] array
  - [x] 2.2: `sendMessage()` calls POST /api/chat, appends user + assistant messages
  - [x] 2.3: Loading state during API call
- [x] Task 3: Wire into WorkflowDashboard (AC: #4)
  - [x] 3.1: Pass `chatSend` as `onAskQuestion` handler
  - [x] 3.2: Merge chat messages into insights array for ProjectChatPanel
- [x] Task 4: Write tests (AC: #6)
  - [x] 4.1: Test API returns answer from mocked Anthropic API
  - [x] 4.2: Test fallback when no API key
  - [x] 4.3: Test 400 for empty/missing/non-string question
  - [x] 4.4: Test Anthropic API error handling
  - [x] 4.5: Test validates question type

## Dev Notes

### Architecture Constraints

- **No Anthropic SDK dependency** — use `fetch` to call the Anthropic Messages API directly. The project follows minimal dependency philosophy.
- **API key from env** — `process.env.ANTHROPIC_API_KEY`. No config file change needed.
- **ProjectContext.fullContext** — already designed for LLM injection (Story 23.1)
- **Fallback-first** — must work without API key (shows helpful message about configuring it)

### Implementation Approach

**API route** (`POST /api/chat`):
```typescript
const apiKey = process.env.ANTHROPIC_API_KEY;
if (!apiKey) return { answer: "Configure ANTHROPIC_API_KEY to enable project chat." };

const context = aggregateProjectContext(phases, artifacts, agents, events);
const response = await fetch("https://api.anthropic.com/v1/messages", {
  method: "POST",
  headers: { "x-api-key": apiKey, "anthropic-version": "2023-06-01", "content-type": "application/json" },
  body: JSON.stringify({
    model: "claude-sonnet-4-20250514",
    max_tokens: 1024,
    system: context.fullContext,
    messages: [{ role: "user", content: question }],
  }),
});
```

**Hook** (`useProjectChat`):
- Manages `ChatMessage[]` array with `{ role: "user" | "assistant", content: string }`
- `sendMessage()` adds user message, calls API, adds assistant response
- Loading state for "typing" indicator

### Files to Create/Modify

1. `packages/web/src/app/api/chat/route.ts` (new)
2. `packages/web/src/hooks/useProjectChat.ts` (new)
3. `packages/web/src/components/WorkflowDashboard.tsx` (modify — wire onAskQuestion)
4. `packages/web/src/app/api/chat/route.test.ts` (new)

### References

- [Source: packages/web/src/lib/workflow/project-context-aggregator.ts] — ProjectContext, aggregateProjectContext
- [Source: packages/web/src/components/ProjectChatPanel.tsx] — the component

## Dev Agent Record

### Agent Model Used

Claude Opus 4.6 (1M context)

### Completion Notes List

- POST /api/chat: validates question, checks API key, calls Anthropic Messages API
- Fallback-first design: works without API key (helpful message)
- useProjectChat hook: manages message history + loading state
- WorkflowDashboard wired: chat messages merged into insights, onAskQuestion connected
- 6 tests covering all AC requirements
- All 1,171 web tests pass, typecheck clean

### File List

- packages/web/src/app/api/chat/route.ts (new — chat API)
- packages/web/src/app/api/chat/route.test.ts (new — 6 tests)
- packages/web/src/hooks/useProjectChat.ts (new — chat hook)
- packages/web/src/components/WorkflowDashboard.tsx (modified — wire chat)
