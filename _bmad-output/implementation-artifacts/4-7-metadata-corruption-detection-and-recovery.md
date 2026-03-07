# Story 4.7: Metadata Corruption Detection and Recovery

Status: ready-for-dev

## Story

As a Developer,
I want the system to detect and recover from corrupted metadata files,
so that the system can recover from data corruption issues.

## Acceptance Criteria

1. **Given** metadata file is corrupted
   - Detect on load (YAML parse fails)
   - Display error with file path
   - Attempt recovery from backup

2. **Given** backup exists
   - Restore from most recent backup
   - Validate restored data

3. **Given** no backup exists
   - Rebuild from available sources
   - Alert user about data loss

4. **Given** I run `ao metadata verify`
   - Check all metadata files
   - Report corruption status

## Tasks /Subtasks

- [ ] Implement metadata validation on load
- [ ] Backup creation before writes
- [ ] Corruption detection and recovery
- [ ] CLI command `ao metadata verify`
- [ ] Write unit tests

## Dev Notes

### Recovery Strategy

1. Try to parse YAML
2. If fails, check for backup
3. If backup exists, restore it
4. If no backup, rebuild from tmux sessions

## Dev Agent Record

_(To be filled by Dev Agent)_
