#!/bin/bash
# BMAD Template Validation Script
#
# Validates that BMAD workflow templates contain required sections
# and have correct structure for task completion validation.
#
# Usage: bash _bmad/bmm/validate-templates.sh
#
# When Story 2-1-1 (Integration Test Framework) or Story 2-1-4
# (CLI Test Infrastructure) is implemented, this should be converted
# to a proper test suite.
#
# @see _bmad-output/implementation-artifacts/2-1-4-cli-test-infrastructure.md

set -eo pipefail

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
NC='\033[0m' # No Color

# File paths
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TEMPLATE_FILE="$SCRIPT_DIR/workflows/4-implementation/create-story/template.md"
INSTRUCTIONS_FILE="$SCRIPT_DIR/workflows/4-implementation/code-review/instructions.xml"
CHECKLIST_FILE="$SCRIPT_DIR/workflows/4-implementation/code-review/task-completion-checklist.md"

# Counters
PASSED=0
FAILED=0

# Test function
test_section() {
  local name="$1"
  local file="$2"
  local pattern="$3"
  local description="$4"

  if grep -q "$pattern" "$file" 2>/dev/null; then
    echo -e "${GREEN}✓${NC} $name"
    PASSED=$((PASSED + 1))
  else
    echo -e "${RED}✗${NC} $name"
    echo "  $description"
    FAILED=$((FAILED + 1))
  fi
}

echo "🔍 Validating BMAD Templates..."
echo ""

# === Task Completion Validation Section ===
echo "Task Completion Validation Section:"

test_section "Has '## Task Completion Validation' section" "$TEMPLATE_FILE" "## Task Completion Validation" "Missing '## Task Completion Validation' section"

test_section "Has '[ ] = Not started' notation" "$TEMPLATE_FILE" "Not started" "Missing '[ ] = Not started' notation"

test_section "Has '[-] = Partially complete' notation" "$TEMPLATE_FILE" "Partially complete" "Missing '[-] = Partially complete' notation"

test_section "Has '[x] = 100% complete' notation" "$TEMPLATE_FILE" "100% complete" "Missing '[x] = 100% complete' notation"

test_section "Has Task Completion Criteria section" "$TEMPLATE_FILE" "\*\*Task Completion Criteria:\*\*" "Missing Task Completion Criteria section"

test_section "Has 'All acceptance criteria met' criteria" "$TEMPLATE_FILE" "All acceptance criteria met" "Missing 'All acceptance criteria met' criteria"

test_section "Has 'All tests passing' criteria" "$TEMPLATE_FILE" "All tests passing" "Missing 'All tests passing' criteria"

test_section "Has 'No hidden TODOs' criteria" "$TEMPLATE_FILE" "No hidden TODOs" "Missing 'No hidden TODOs' criteria"

test_section "Has Deferred Items Tracking section" "$TEMPLATE_FILE" "\*\*Deferred Items Tracking:\*\*" "Missing Deferred Items Tracking section"

test_section "Has 'Limitations (Deferred Items)' example" "$TEMPLATE_FILE" "### Limitations (Deferred Items)" "Missing 'Limitations (Deferred Items)' example"

test_section "Has Task Completion Validation Checklist" "$TEMPLATE_FILE" "\*\*Task Completion Validation Checklist:\*\*" "Missing Task Completion Validation Checklist"

test_section "Has 'All tasks marked [x] are 100% complete' checkbox" "$TEMPLATE_FILE" "All tasks marked" "Missing 'All tasks marked [x] are 100% complete' checkbox"

test_section "Has 'All tests have real assertions' checkbox" "$TEMPLATE_FILE" "All tests have real assertions" "Missing 'All tests have real assertions' checkbox"

test_section "Has 'No hidden TODOs/FIXMEs' checkbox" "$TEMPLATE_FILE" "No hidden TODOs" "Missing 'No hidden TODOs/FIXMEs' checkbox"

test_section "Has 'Deferred items documented in Dev Notes' checkbox" "$TEMPLATE_FILE" "Deferred items documented in Dev Notes" "Missing 'Deferred items documented in Dev Notes' checkbox"

test_section "Has 'File List includes all changed files' checkbox" "$TEMPLATE_FILE" "File List includes all changed files" "Missing 'File List includes all changed files' checkbox"

test_section "Has reference to task-completion-guidelines.md" "$TEMPLATE_FILE" "_bmad/bmm/docs/task-completion-guidelines.md" "Missing reference to task-completion-guidelines.md"

echo ""
echo "Interface Validation Section:"

test_section "Has '## Interface Validation' section" "$TEMPLATE_FILE" "## Interface Validation" "Missing '## Interface Validation' section"

test_section "Has Interface Validation checkbox" "$TEMPLATE_FILE" "Validate all interface methods" "Missing Interface Validation checkbox"

echo ""
echo "Code Review Instructions:"

test_section "Instructions reference task-completion-checklist.md" "$INSTRUCTIONS_FILE" "task-completion-checklist.md" "Missing reference to task-completion-checklist.md"

test_section "Instructions include 'All acceptance criteria met'" "$INSTRUCTIONS_FILE" "All acceptance criteria met" "Missing 'All acceptance criteria met' in instructions"

test_section "Instructions include 'Tests are real assertions'" "$INSTRUCTIONS_FILE" "Tests are real assertions" "Missing 'Tests are real assertions' in instructions"

echo ""
echo "Task Completion Checklist File:"

test_section "Checklist has '## Core Principles' section" "$CHECKLIST_FILE" "## Core Principles" "Missing '## Core Principles' section in checklist"

test_section "Checklist has '[x] means 100% complete' principle" "$CHECKLIST_FILE" "means 100% complete" "Missing '[x] means 100% complete' principle"

test_section "Checklist has '## Task Completion Validation' section" "$CHECKLIST_FILE" "## Task Completion Validation" "Missing '## Task Completion Validation' section in checklist"

test_section "Checklist has '## Code Review Validation Checklist' section" "$CHECKLIST_FILE" "## Code Review Validation Checklist" "Missing '## Code Review Validation Checklist' section in checklist"

echo ""
echo "Section Ordering:"

# Test that Task Completion Validation comes before Interface Validation
TASK_COMPLETION_LINE=$(grep -n "## Task Completion Validation" "$TEMPLATE_FILE" | cut -d: -f1)
INTERFACE_VALIDATION_LINE=$(grep -n "## Interface Validation" "$TEMPLATE_FILE" | cut -d: -f1)

if [ -n "$TASK_COMPLETION_LINE" ] && [ -n "$INTERFACE_VALIDATION_LINE" ] && [ "$TASK_COMPLETION_LINE" -lt "$INTERFACE_VALIDATION_LINE" ]; then
  echo -e "${GREEN}✓${NC} Task Completion Validation comes before Interface Validation"
  PASSED=$((PASSED + 1))
else
  echo -e "${RED}✗${NC} Task Completion Validation comes before Interface Validation"
  echo "  Task Completion Validation should come before Interface Validation"
  FAILED=$((FAILED + 1))
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo -e "Results: ${GREEN}$PASSED passed${NC}, ${RED}$FAILED failed${NC}, $((PASSED + FAILED)) total"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

if [ $FAILED -gt 0 ]; then
  echo ""
  echo -e "${RED}Validation failed!${NC}"
  echo ""
  echo "Note: When Story 2-1-1 (Integration Test Framework) or"
  echo "Story 2-1-4 (CLI Test Infrastructure) is implemented,"
  echo "this should be converted to a proper test suite."
  exit 1
else
  echo ""
  echo -e "${GREEN}✓ All template validation checks passed!${NC}"
  echo ""
  echo "Note: When Story 2-1-1 (Integration Test Framework) or"
  echo "Story 2-1-4 (CLI Test Infrastructure) is implemented,"
  echo "this should be converted to a proper test suite."
  exit 0
fi
