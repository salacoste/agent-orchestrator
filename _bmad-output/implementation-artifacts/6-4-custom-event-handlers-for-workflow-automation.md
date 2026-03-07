# Story 6.4: Custom Event Handlers for Workflow Automation

Status: ready-for-dev

## Story

As a Plugin Developer,
I want to define custom event handlers that execute workflows based on triggers,
so that I can automate complex processes without modifying core code.

## Acceptance Criteria

1. **Given** I implement an event handler
   - Subscribe to events
   - Handler invoked when events occur
   - Full event context available

2. **Given** event handler throws error
   - Error logged with plugin and handler name
   - Event marked as "failed"
   - Other handlers continue

3. **Given** I define workflow with steps
   - Steps execute in sequence
   - Each step receives previous step's result
   - Conditional steps with `if` condition

4. **Given** I want async workflow execution
   - `async: true` for async steps
   - Queue and execute asynchronously
   - Log result when completes

5. **Given** I run `ao workflows --history`
   - Table showing: workflow name, trigger event, status, start time, duration, current step

## Tasks / Subtasks

- [ ] Implement event subscription in plugins
- [ ] Define workflow DSL (YAML)
- [ ] Implement step execution engine
- [ ] Conditional step execution
- [ ] Async step queuing
- [ ] Retry logic for failed steps
- [ ] CLI command `ao workflows --history`
- [ ] Write unit tests

## Dev Notes

### Workflow Definition

```yaml
workflows:
  - name: "on-completion-cleanup"
    trigger:
      event: { type: "story.completed" }
    steps:
      - action: "updateBurndown"
      - action: "notifyTeam"
        params: { channel: "#dev-updates" }
      - action: "checkDependents"
      - action: "assignNextStory"
```

### Plugin Event Handler

```typescript
async onStoryCreated(event: Event) {
  const story = event.data.story;
  if (story.priority === "high") {
    const agent = await context.agents.spawn({ storyId: story.id });
    context.logger.info(`Auto-assigned agent ${agent.id}`);
  }
}
```

## Dependencies

- Story 6.2 (Plugin API) - Plugin interface
- Story 6.3 (Custom Triggers) - Trigger conditions

## Dev Agent Record

_(To be filled by Dev Agent)_
