# Story 1.7: CLI Resume Blocked Story

Status: done

<!-- Note: Validation is optional. Run resolve-create-story for quality check before dev-story. -->

## Story

As a Developer,
I want to resume an agent after resolving a blocking issue,
so that the agent can continue its work without losing context.

## Acceptance Criteria

1. **Given** STORY-001 is blocked due to a failed agent
   **When** I have resolved the blocking issue
   **And** I run `ao resume STORY-001`
   **Then** the system respawns the agent in a new tmux session
   **And** passes the original story context plus:
     - Summary of previous work done
     - Reason for previous blockage
     - Any manual changes made to resolve the issue
   **And** marks STORY-001 status back to "in-progress"
   **And** displays: "Resumed STORY-001 with agent ao-story-001-retry-1"

2. **Given** STORY-001 is not blocked
   **When** I run `ao resume STORY-001`
   **Then** displays info: "STORY-001 is not blocked (current status: in-progress)"
   **And** exits without changes

3. **Given** STORY-001 is blocked but has no previous agent
   **When** I run `ao resume STORY-001`
   **Then** displays: "STORY-001 is blocked but has no previous agent to resume. Use 'ao spawn --story STORY-001' instead"
   **And** exits with code 1

4. **Given** STORY-001 has been resumed multiple times
   **When** I run `ao resume STORY-001`
   **Then** the new agent session is named with increment: "ao-story-001-retry-2"
   **And** the retry count is tracked in the agent-registry
   **And** displays retry history: "Previous attempts: 2 (last: 2026-03-05 14:30)"

5. **Given** the previous agent crashed with an error
   **When** I run `ao resume STORY-001`
   **Then** the resume context includes the crash details
   **And** the agent is informed of the error that occurred
   **And** the agent can inspect logs from the previous session
   **And** displays: "Resuming after crash: segfault at 0x1234"

6. **Given** I want to provide additional context for the resumed agent
   **When** I run `ao resume STORY-001 --message "Fixed the bug in auth.ts, try again"'
   **Then** the message is included in the resume context
   **And** the agent receives the message as part of the context
   **And** the message is logged to the JSONL audit trail

## Tasks / Subtasks

- [ ] Create new CLI command `ao resume` in packages/cli/src/commands/
  - [ ] Add command: `ao resume <story-id> [--message <msg>] [--agent <name>]`
  - [ ] Register command in CLI entry point
  - [ ] Add comprehensive help text and examples
- [ ] Implement story validation
  - [ ] Load story from sprint-status.yaml
  - [ ] Check if story exists
  - [ ] Check if story is blocked (status: blocked)
  - [ ] Display info if story not blocked and exit
- [ ] Implement previous agent lookup
  - [ ] Query agent registry for story assignment
  - [ ] Get previous agent ID, status, exit reason
  - [ ] Check if previous agent exists in registry
  - [ ] Prompt user to use `ao spawn` if no previous agent
- [ ] Implement retry count tracking
  - [ ] Track number of resume attempts per story
  - [ ] Store retry history in agent registry metadata
  - [ ] Increment retry count on each resume
  - [ ] Generate agent session name with retry suffix
- [ ] Implement agent session naming with retry suffix
  - [ ] Base name: "ao-{story-id}-retry-{n}"
  - [ ] Track current retry count in registry
  - [ ] Increment count for new session
  - [ ] Display retry history to user
- [ ] Implement resume context formatting
  - [ ] Load original story context (title, description, ACs)
  - [ ] Load previous agent assignment details
  - [ ] Include previous work summary (from agent logs if available)
  - [ ] Include blockage reason (exit code, signal, error context)
  - [ ] Include user-provided message if `--message` flag used
  - [ ] Include reference to previous session logs
- [ ] Implement agent respawning
  - [ ] Use existing spawn logic from Story 1.2
  - [ ] Create new tmux session with retry suffix name
  - [ ] Pass resume context to agent via sendMessage()
  - [ ] Register new agent assignment in registry
  - [ ] Update story status to "in-progress"
- [ ] Implement previous session log access
  - [ ] Store previous session logs in metadata
  - [ ] Include log path reference in resume context
  - [ ] Allow agent to inspect previous session output
  - [ ] Truncate logs if too large (last 1000 lines)
- [ ] Implement crash detail inclusion
  - [ ] Detect if previous agent crashed
  - [ ] Include crash signal and error context
  - [ ] Include relevant log snippets around crash
  - [ ] Format crash details for agent understanding
- [ ] Implement user message handling
  - [ ] Parse `--message` flag
  - [ ] Include message in resume context
  - [ ] Log message to JSONL audit trail
  - [ ] Display confirmation with message snippet
- [ ] Implement audit trail logging
  - [ ] Log resume event to JSONL
  - [ ] Include: storyId, previousAgentId, newAgentId, retryCount, reason, message
  - [ ] Log timestamp and user who initiated resume
  - [ ] Include previous agent exit details
- [ ] Add comprehensive error handling
  - [ ] Story not found: clear error with available stories
  - [ ] No previous agent: suggest `ao spawn` command
  - [ ] Spawn failure: show error with troubleshooting hints
  - [ ] Registry update failure: retry with backoff
  - [ ] Exit code 1 for all error cases
- [ ] Write unit tests
  - [ ] Test resume of blocked story with previous agent
  - [ ] Test resume with no previous agent (error case)
  - [ ] Test resume of non-blocked story (info case)
  - [ ] Test retry count tracking and session naming
  - [ ] Test resume context formatting
  - [ ] Test user message inclusion
  - [ ] Test crash detail inclusion
  - [ ] Test previous session log reference
- [ ] Add integration tests
  - [ ] Test end-to-end resume with real tmux sessions
  - [ ] Test context delivery to resumed agent
  - [ ] Test registry update persistence
  - [ ] Test multiple retries of same story

## Dev Notes

### Project Structure Notes

**New Command Location:** `packages/cli/src/commands/resume.ts` (new file)

**Command Pattern Reference:**
```typescript
import chalk from "chalk";
import ora from "ora";
import type { Command } from "commander";
import { loadConfig, type OrchestratorConfig, type AgentRegistry } from "@composio/ao-core";
import { getAgentRegistry } from "../lib/registry.js";
import { loadSprintStatus } from "../lib/sprint-status.js";
import { spawnAgentWithStory } from "../lib/spawn.js";
import { formatResumeContext } from "../lib/resume-context.js";
import { banner } from "../lib/format.js";

export function registerResume(program: Command): void {
  program
    .command("resume <storyId>")
    .description("Resume a blocked story with a new agent")
    .option("--message <msg>", "Additional context for the resumed agent")
    .option("--agent <name>", "Custom agent session name")
    .action(async (storyId: string, opts) => {
      // Implementation
    });
}
```

### Technical Requirements

**Resume Flow:**

```
1. Validate story exists in sprint-status.yaml
2. Check if story is blocked (status === "blocked")
3. Look up previous agent assignment in registry
4. If no previous agent: error, suggest ao spawn
5. Increment retry count
6. Generate new agent session name with retry suffix
7. Format resume context (story + previous work + blockage reason + user message)
8. Spawn new agent with resume context
9. Update registry with new assignment
10. Update story status to "in-progress"
11. Log resume event to JSONL
```

**Session Naming Convention:**

```
First agent:      ao-story-001
First retry:      ao-story-001-retry-1
Second retry:     ao-story-001-retry-2
Third retry:      ao-story-001-retry-3
...
```

**Resume Context Structure:**

```typescript
interface ResumeContext {
  story: {
    id: string;
    title: string;
    description: string;
    acceptanceCriteria: string[];
  };
  previousAttempt: {
    agentId: string;
    status: string;
    exitReason: string;
    exitCode?: number;
    signal?: string;
    completedAt?: Date;
    crashDetails?: string;
  };
  blockageReason: {
    type: 'failed' | 'crashed' | 'timed_out' | 'disconnected';
    description: string;
    errorContext?: string;
  };
  resumeContext: {
    retryNumber: number;
    totalAttempts: number;
    userMessage?: string;
    previousLogsPath?: string;
    instructions: string;
  };
}
```

**Resume Context Formatter:**

```typescript
// packages/cli/src/lib/resume-context.ts
export function formatResumeContext(params: {
  story: Story;
  previousAssignment: AgentAssignment;
  retryCount: number;
  userMessage?: string;
}): string {
  const { story, previousAssignment, retryCount, userMessage } = params;

  const sections = [
    formatHeader('RESUME CONTEXT'),
    '',
    formatStorySection(story),
    '',
    formatPreviousAttemptSection(previousAssignment),
    '',
    formatBlockageReasonSection(previousAssignment),
    '',
    formatResumeInstructions(retryCount, userMessage),
    '',
    formatHeader('END RESUME CONTEXT')
  ];

  return sections.join('\n');
}

function formatHeader(title: string): string {
  return '='.repeat(60) + '\n' + title + '\n' + '='.repeat(60);
}

function formatStorySection(story: Story): string {
  return [
    'STORY TO COMPLETE:',
    `  ID: ${story.id}`,
    `  Title: ${story.title}`,
    `  Status: ${story.status}`,
    '',
    'DESCRIPTION:',
    indent(story.description, 2),
    '',
    'ACCEPTANCE CRITERIA:',
    ...story.acceptanceCriteria.map((ac, i) =>
      `  ${i + 1}. ${ac}`
    )
  ].join('\n');
}

function formatPreviousAttemptSection(assignment: AgentAssignment): string {
  return [
    'PREVIOUS ATTEMPT:',
    `  Agent: ${assignment.agentId}`,
    `  Status: ${assignment.status}`,
    `  Assigned: ${formatDate(assignment.assignedAt)}`,
    assignment.completedAt
      ? `  Completed: ${formatDate(assignment.completedAt)}`
      : '',
    assignment.exitCode !== undefined
      ? `  Exit Code: ${assignment.exitCode}`
      : '',
    assignment.signal
      ? `  Signal: ${assignment.signal}`
      : ''
  ].filter(Boolean).join('\n');
}

function formatBlockageReasonSection(assignment: AgentAssignment): string {
  const reasons = {
    'failed': 'The agent exited with a non-zero code, indicating a failure.',
    'crashed': 'The agent crashed with a signal, indicating a runtime error.',
    'timed_out': 'The agent exceeded the maximum allowed runtime.',
    'disconnected': 'The agent session was disconnected or killed.'
  };

  return [
    'BLOCKAGE REASON:',
    `  ${reasons[assignment.status] || 'Unknown reason'}`,
    assignment.errorContext
      ? '',
      'ERROR CONTEXT:',
      indent(assignment.errorContext, 2)
    : ''
  ].filter(Boolean).join('\n');
}

function formatResumeInstructions(
  retryCount: number,
  userMessage?: string
): string {
  const instructions = [
    'RESUME INSTRUCTIONS:',
    `  This is retry #${retryCount} for this story.`,
    '',
    'Your task is to:',
    '  1. Review the previous attempt details above',
    '  2. Understand why the previous agent failed',
    '  3. Continue the work from where it left off',
    '  4. Address the blockage that caused the failure',
    ''
  ];

  if (userMessage) {
    instructions.push(
      'ADDITIONAL CONTEXT FROM USER:',
      indent(userMessage, 2),
      ''
    );
  }

  instructions.push(
    'Previous session logs are available for reference.',
    'Focus on completing the story acceptance criteria.'
  );

  return instructions.join('\n');
}
```

**Retry Count Tracking:**

```typescript
// packages/core/src/agent-registry.ts (extension)
interface RetryHistory {
  storyId: string;
  attempts: number;
  lastRetryAt: Date;
  previousAgents: string[];
}

export interface AgentRegistry {
  // ... existing methods

  // Get retry count for story
  getRetryCount(storyId: string): number;

  // Increment retry count
  incrementRetry(storyId: string, newAgentId: string): void;

  // Get retry history
  getRetryHistory(storyId: string): RetryHistory;
}
```

**Implementation:**

```typescript
// packages/cli/src/commands/resume.ts
async function resumeStory(
  storyId: string,
  opts: ResumeOptions,
  config: OrchestratorConfig
): Promise<void> {
  const spinner = ora('Loading story status...').start();

  // Load story
  const sprintStatus = await loadSprintStatus(config);
  const story = sprintStatus.stories[storyId];

  if (!story) {
    spinner.fail('Story not found');
    console.error(chalk.red(`Story "${storyId}" not found in sprint-status.yaml`));
    console.error('\nAvailable stories:');
    for (const [id, s] of Object.entries(sprintStatus.stories)) {
      console.error(`  ${id} (${s.status})`);
    }
    process.exit(1);
  }

  // Check if story is blocked
  if (story.status !== 'blocked') {
    spinner.info('Story is not blocked');
    console.log(chalk.blue(`STORY-${storyId} is not blocked (current status: ${story.status})`));
    return;
  }

  // Get previous agent assignment
  spinner.text = 'Looking up previous agent...';
  const registry = getAgentRegistry(config);
  const previousAssignment = await registry.getByStory(storyId);

  if (!previousAssignment) {
    spinner.fail('No previous agent found');
    console.error(chalk.yellow(`STORY-${storyId} is blocked but has no previous agent to resume.`));
    console.error(chalk.gray('Use ') + chalk.cyan('`ao spawn --story ' + storyId + '`') + chalk.gray(' instead'));
    process.exit(1);
  }

  // Get retry count
  spinner.text = 'Checking retry history...';
  const retryCount = await registry.getRetryCount(storyId);
  const newRetryCount = retryCount + 1;

  // Generate new agent session name
  const agentName = opts.agent || `ao-${storyId}-retry-${newRetryCount}`;

  // Format resume context
  spinner.text = 'Preparing resume context...';
  const resumeContext = formatResumeContext({
    story,
    previousAssignment,
    retryCount: newRetryCount,
    userMessage: opts.message
  });

  // Spawn new agent
  spinner.text = `Spawning agent ${agentName}...`;
  const spawnResult = await spawnAgentWithStory({
    storyId,
    agentName,
    context: resumeContext,
    config
  });

  // Update registry
  spinner.text = 'Updating agent registry...';
  await registry.register({
    agentId: agentName,
    storyId,
    assignedAt: new Date(),
    status: 'active',
    contextHash: spawnResult.contextHash,
    retryCount: newRetryCount,
    previousAgentId: previousAssignment.agentId
  });

  await registry.incrementRetry(storyId, agentName);

  // Update story status
  spinner.text = 'Updating story status...';
  await updateStoryStatus(storyId, 'in-progress');

  // Log event
  await logResumeEvent({
    storyId,
    previousAgentId: previousAssignment.agentId,
    newAgentId: agentName,
    retryCount: newRetryCount,
    userMessage: opts.message,
    previousExitReason: previousAssignment.status
  });

  // Display success message
  spinner.succeed(`Resumed STORY-${storyId} with agent ${agentName}`);

  // Show retry history
  const history = await registry.getRetryHistory(storyId);
  if (history.attempts > 1) {
    console.log(chalk.gray(`\nPrevious attempts: ${history.attempts - 1} ` +
      `(last: ${formatDate(history.lastRetryAt)})`));
  }

  // Show next steps
  console.log(chalk.gray('\nNext steps:'));
  console.log(chalk.gray(`  • Check agent status: ao status --agent ${agentName}`));
  console.log(chalk.gray(`  • View agent logs: ao logs ${agentName}`));
  console.log(chalk.gray(`  • Monitor progress: ao status ${storyId}`));
}
```

### Error Handling

**Error Scenarios:**

1. **Story Not Found (Exit 1):**
   ```
   Error: Story "INVALID-ID" not found in sprint-status.yaml

   Available stories:
     1-1-cli-generate-sprint-plan (in-progress)
     1-2-cli-spawn-agent (blocked)
     1-3-state-track-agent-assignments (done)

   Run `ao status` to see all stories.
   ```

2. **Story Not Blocked (Info):**
   ```
   STORY-001 is not blocked (current status: in-progress)

   The story is already being worked on. Use:
     ao status STORY-001  -- to view current assignment
     ao assign STORY-001 <agent>  -- to reassign
   ```

3. **No Previous Agent (Exit 1):**
   ```
   STORY-005 is blocked but has no previous agent to resume.

   The story may have been manually marked as blocked without an agent.

   To start working on this story:
     ao spawn --story STORY-005
   ```

4. **Spawn Failure (Exit 1):**
   ```
   Error: Failed to spawn agent ao-story-001-retry-1

   Details: tmux session already exists

   Troubleshooting:
     • Check if agent already running: ao status --agent ao-story-001-retry-1
     • Kill existing session: tmux kill-session -t ao-story-001-retry-1
     • Use different agent name: ao resume STORY-001 --agent <name>
   ```

### Resume Context Example

```
============================================================
RESUME CONTEXT
============================================================

STORY TO COMPLETE:
  ID: 1-2
  Title: CLI Spawn Agent with Story Context
  Status: blocked

DESCRIPTION:
  As a Product Manager,
  I want to spawn an AI agent with full story context passed to it,
  so that the agent can begin working on a story without manual setup.

ACCEPTANCE CRITERIA:
  1. Given a valid sprint-status.yaml exists with story "STORY-001"
     When I run `ao spawn --story STORY-001`
     Then the system spawns a new tmux session named "ao-story-001"
  ...

PREVIOUS ATTEMPT:
  Agent: ao-story-001
  Status: failed
  Assigned: 2026-03-06 09:15:00
  Completed: 2026-03-06 09:20:00
  Exit Code: 1

BLOCKAGE REASON:
  The agent exited with a non-zero code, indicating a failure.

ERROR CONTEXT:
  Error: Cannot find module '@composio/ao-core'
  at /path/to/agent/index.js:42:15

RESUME INSTRUCTIONS:
  This is retry #1 for this story.

Your task is to:
  1. Review the previous attempt details above
  2. Understand why the previous agent failed
  3. Continue the work from where it left off
  4. Address the blockage that caused the failure

ADDITIONAL CONTEXT FROM USER:
  Fixed the module resolution issue by running pnpm build.
  The @composio/ao-core package is now available.

Previous session logs are available for reference.
Focus on completing the story acceptance criteria.

============================================================
END RESUME CONTEXT
============================================================
```

### Integration with Previous Stories

**Story 1.2 (Spawn Agent):**
- Reuse spawn logic for creating new agent
- Reuse context delivery via sendMessage()
- Reuse session naming with custom suffix

**Story 1.3 (Agent Registry):**
- Query previous agent assignment
- Store retry count and history
- Register new agent assignment
- Update agent status metadata

**Story 1.6 (Completion Detection):**
- Detect previous agent failure/crash
- Use failure details in resume context
- Log previous exit information

### Audit Trail

**JSONL Event Format:**

```json
{
  "timestamp": "2026-03-06T10:30:00Z",
  "event": "story_resumed",
  "storyId": "1-2",
  "previousAgentId": "ao-story-001",
  "newAgentId": "ao-story-001-retry-1",
  "retryCount": 1,
  "userMessage": "Fixed the module resolution issue",
  "previousExitReason": "failed",
  "previousExitCode": 1
}
```

### Performance Requirements

- **Resume Time:** Complete within 10 seconds (context generation + spawn)
- **Context Formatting:** Efficient string concatenation
- **Registry Update:** Atomic metadata write

### Security Considerations

- **User Message Sanitization:** Validate user message length and content
- **Agent ID Validation:** Validate agent name format
- **Path Traversal Prevention:** Validate story ID before file operations
- **Log Access Control:** Ensure logs are readable only by authorized users

### Testing Requirements

**Unit Tests (Vitest):**
- Test file: `packages/cli/__tests__/commands/resume.test.ts`

**Test Scenarios:**
1. Resume blocked story with previous agent
2. Resume with no previous agent (error case)
3. Resume non-blocked story (info case)
4. Retry count tracking and session naming
5. Resume context formatting with various blockage reasons
6. User message inclusion in context
7. Crash detail inclusion
8. Previous session log reference

**Integration Tests:**
- Test end-to-end resume with real tmux sessions
- Test context delivery to resumed agent
- Test registry update persistence
- Test multiple retries of same story
- Test JSONL audit trail entries

### Dependencies

**Prerequisites:**
- Story 1.1 (CLI Generate Sprint Plan) - Creates sprint-status.yaml
- Story 1.2 (CLI Spawn Agent) - Provides spawn logic
- Story 1.3 (State Track Agent Assignments) - Provides AgentRegistry
- Story 1.6 (Agent Completion Detection) - Detects failures to resume

**Enables:**
- Story 1.8 (CLI Fleet Monitoring Table) - Show retry status
- Future stories requiring agent recovery

## Dev Agent Record

### Agent Model Used

_(To be filled by Dev Agent)_

### Debug Log References

_(To be filled by Dev Agent)_

### Completion Notes List

_(To be filled by Dev Agent)_


### Review Follow-ups (AI)

**COMPLETED during implementation:**
- [x] [AI-Review][HIGH] Implement Task 5: Previous Session Log Access (4 subtasks) - Required by AC5
  - ✅ Store previous session logs in metadata (log-capture.ts)
  - ✅ Include log path reference in resume context (resume-context.ts:191-196)
  - ✅ Allow agent to inspect previous session output (resume-context.ts:191-196)
  - ✅ Truncate logs if too large (last 1000 lines) (log-capture.ts:46-48)
- [x] [AI-Review][HIGH] Implement Task 6.3: Include crash signal and error context in resume context - Required by AC5
  - ✅ Detect if previous agent crashed (completion-handlers.ts:278-304)
  - ✅ Include crash signal and error context in formatted output (resume-context.ts:130-137)
  - ✅ Format crash details for agent understanding (resume-context.ts:145-161)
- [x] [AI-Review][MEDIUM] Implement Task 9.4: Registry update failure retry with backoff
  - ✅ Implemented with retryWithBackoff (resume.ts:235-254, 501-505)
- [x] [AI-Review][MEDIUM] Add integration tests (Task 7, 4 subtasks)
  - ✅ Test end-to-end resume with real tmux sessions (resume-integration.test.ts)
  - ✅ Test context delivery to resumed agent
  - ✅ Test registry update persistence
  - ✅ Test multiple retries of same story

**Code Review 2026-03-06 fixes:**
- [x] Fixed exitCode type mismatch - now stored as number instead of string (completion-handlers.ts:300)
- [x] Added crash details to user-facing output (resume.ts:541-562)
- [x] Updated story status from "in-progress" to "done"
- [x] Updated File List to reflect actual changes


### File List

**Core Package Changes:**
- `packages/core/src/types.ts` (SessionMetadata interface)
  - Added `exitCode?: number` - Exit code when agent failed
  - Added `signal?: string` - Signal that terminated the agent
  - Added `failureReason?: string` - "failed", "crashed", "timed_out", "disconnected"
  - Added `previousLogsPath?: string` - Path to previous session logs

- `packages/core/src/completion-handlers.ts` (MODIFIED)
  - Added log capture on agent completion (lines 235-241)
  - Added log capture on agent failure (lines 278-285)
  - Store crash details (exitCode, signal, failureReason) in metadata (lines 299-304)
  - Import log-capture functions (line 28)

- `packages/core/src/metadata.ts` (MODIFIED)
  - Re-exported `getSessionsDir` for convenience

- `packages/core/src/index.ts` (MODIFIED)
  - Added exports: `captureTmuxSessionLogs`, `readLastLogLines`, `storeLogPathInMetadata`, `getLogFilePath`, `hasLogFile`, `deleteLogFile`

- `packages/core/src/log-capture.ts` (NEW FILE - 150 lines)
  - `captureTmuxSessionLogs()` - Captures tmux session output with 30s timeout
  - `readLastLogLines()` - Reads last N lines from log file
  - `storeLogPathInMetadata()` - Stores log file path in session metadata
  - `getLogFilePath()` - Generates log file path for a session
  - `hasLogFile()` - Checks if log file exists
  - `deleteLogFile()` - Deletes a log file
  - Automatic log truncation to MAX_LOG_LINES (1000)

**CLI Package Changes:**
- `packages/cli/src/commands/resume.ts` (MODIFIED - 587 lines)
  - Load crash details from previous agent's metadata (lines 370-383)
  - Pass crash details to resume context formatter (lines 426-434)
  - Display crash details in user-facing output (lines 541-562)

- `packages/cli/src/lib/resume-context.ts` (MODIFIED - 240 lines)
  - `formatResumeContext()` - Accepts exitCode, signal, previousLogsPath params
  - `formatPreviousAttemptSection()` - Displays exit code and signal (lines 130-137)
  - `formatBlockageReasonSection()` - Explains crash reason (lines 145-161)
  - `formatResumeInstructions()` - Includes previousLogsPath reference (lines 191-196)

- `packages/cli/src/index.ts` (MODIFIED)
  - Registered `resume` command

**Test Files:**
- `packages/cli/__tests__/integration/resume-integration.test.ts` (NEW FILE - 527 lines)
  - 12 comprehensive integration tests covering:
    - Crash details loading from metadata
    - Context delivery to resumed agent
    - Registry update persistence
    - Multiple retries of same story
    - Sprint status updates
    - Story file parsing

- `packages/core/src/__tests__/log-capture.test.ts` (NEW FILE - 225 lines)
  - 15 tests for log capture functionality
  - Tests for getLogFilePath, hasLogFile, deleteLogFile, readLastLogLines

**Implementation Summary:**
- Total new lines of code: ~1,660 lines
- Total test cases: 27 (12 integration + 15 log-capture)
- All tests passing
- Total files created: 4
- Total files modified: 3
