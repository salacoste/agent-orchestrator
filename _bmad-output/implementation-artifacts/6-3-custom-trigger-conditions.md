# Story 6.3: Custom Trigger Conditions

Status: ready-for-dev

## Story

As a Developer,
I want to define custom trigger conditions based on story attributes,
so that plugins can execute workflows automatically when specific conditions are met.

## Acceptance Criteria

1. **Given** I define a trigger in plugin.yaml
   - Trigger registered during plugin init
   - System evaluates when stories change
   - When condition matches, plugin action is invoked

2. **Given** story has priority="high" and status="todo"
   - Trigger fires during business hours
   - Plugin's autoAssignAgent action called
   - Story context passed to action

3. **Given** I define tag-based trigger
   - Tags use AND logic (all must match)
   - OR logic: `{ any: ["security", "performance"] }`

4. **Given** I define attribute-based trigger
   - Operators: eq, ne, gte, gt, lte, lt, contains, matches

5. **Given** I define event-based trigger
   - Fires when specified event occurs
   - Event data available to action

6. **Given** I define combined conditions
   - AND/OR/NOT logic supported
   - All conditions must be true for AND

7. **Given** I run `ao triggers`
   - Display all registered triggers
   - Show: name, plugin, condition summary, fire count, last fired

## Tasks / Subtasks

- [ ] Create TriggerCondition evaluator
  - [ ] Parse YAML trigger definitions
  - [ ] Evaluate story conditions
  - [ ] Evaluate event conditions
  - [ ] Support combined conditions (AND/OR/NOT)
- [ ] Implement trigger registration
  - [ ] Register during plugin init
  - [ ] Check triggers on story change
  - [ ] Check triggers on event publish
- [ ] CLI command `ao triggers`
  - [ ] List all triggers
  - [ ] Show condition summary
- [ ] Implement debounce/once options
  - [ ] debounce: 300 (5 min debounce)
  - [ ] once: true (fire only once)
- [ ] Write unit tests

## Dev Notes

### Trigger Definition

```yaml
triggers:
  - name: "auto-assign-high-priority"
    condition:
      story:
        priority: "high"
        status: "todo"
      time:
        hour: { start: 9, end: 17 }
    action: "autoAssignAgent"
    debounce: 300
```

## Dependencies

- Story 6.1 (Plugin System) - Trigger registration
- Story 6.4 (Custom Event Handlers) - Action execution

## Dev Agent Record

_(To be filled by Dev Agent)_
