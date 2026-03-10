/**
 * Workflow Engine
 *
 * Executes workflows defined in plugin.yaml files.
 * Supports sequential execution, conditional steps, async queuing, and retry logic.
 */

/** Plugin-provided action handler */
export type ActionHandler = (context: {
  data?: Record<string, unknown>;
  previousResult?: unknown;
  step: WorkflowStep;
}) => unknown | Promise<unknown>;

/** Workflow context passed during execution */
export interface WorkflowContext {
  /** Logger for logging messages */
  logger: {
    info(message: string): void;
    error(message: string): void;
    warn(message: string): void;
  };
  /** State manager for accessing/updating state */
  state: {
    get(key: string): unknown | undefined;
    set(key: string, value: unknown): void;
  };
  /** Event emitter for emitting events */
  events: {
    emit(event: string, data: unknown): void;
  };
  /** Additional data context */
  data?: Record<string, unknown>;
}

/** Workflow step definition */
export interface WorkflowStep {
  /** Action name or handler */
  action: string;
  /** Conditional execution - if false, step is skipped */
  if?: ConditionalExpression;
  /** Execute asynchronously (queued) */
  async?: boolean;
  /** Parameters to pass to action */
  params?: Record<string, unknown>;
  /** Retry configuration */
  retry?: {
    /** Maximum retry attempts */
    maxAttempts?: number;
    /** Delay between retries in ms */
    delay?: number;
    /** Backoff multiplier for exponential backoff */
    backoffMultiplier?: number;
  };
}

/** Conditional expression for step execution */
export interface ConditionalExpression {
  /** Field to check (e.g., "previousResult.status") */
  field: string;
  /** Comparison operator */
  operator: "eq" | "ne" | "gt" | "gte" | "lt" | "lte" | "contains" | "exists" | "truthy";
  /** Value to compare against */
  value?: unknown;
}

/** Trigger definition - when to start workflow */
export interface TriggerDefinition {
  /** Event-based trigger */
  event?: {
    type: string;
  };
  /** Trigger-based trigger (future) */
  trigger?: {
    condition: unknown;
  };
}

/** Workflow definition from plugin.yaml */
export interface WorkflowDefinition {
  /** Unique workflow name */
  name: string;

  /** When to execute this workflow */
  trigger: TriggerDefinition;

  /** Steps to execute in sequence */
  steps: WorkflowStep[];

  /** Plugin that owns this workflow */
  plugin?: string;

  /** Retry configuration for entire workflow */
  retry?: {
    /** Maximum retry attempts */
    maxAttempts?: number;
    /** Delay between retries in ms */
    delay?: number;
  };
}

/** Workflow execution status */
export type WorkflowStatus = "pending" | "running" | "completed" | "failed" | "async";

/** Workflow execution history entry */
export interface WorkflowHistoryEntry {
  /** Unique execution ID */
  id: string;
  /** Workflow name */
  workflowName: string;
  /** Plugin that owns the workflow */
  plugin?: string;
  /** Trigger event that started this workflow */
  triggerEvent?: string;
  /** Execution status */
  status: WorkflowStatus;
  /** When execution started */
  startTime: string;
  /** Execution duration in ms */
  duration: number;
  /** Number of steps executed */
  executedSteps: number;
  /** Total steps */
  totalSteps: number;
  /** Current step index */
  currentStep?: number;
  /** Error message if failed */
  error?: string;
  /** Result of last executed step */
  lastResult?: unknown;
}

/** Workflow execution result */
export interface WorkflowExecutionResult {
  /** Execution status */
  status: WorkflowStatus;
  /** Number of steps executed */
  executedSteps: number;
  /** Error message if failed */
  error?: string;
  /** Result of workflow execution */
  result?: unknown;
  /** Execution duration in ms */
  duration: number;
}

/** Workflow engine interface */
export interface WorkflowEngine {
  /** Register workflow definitions */
  register(workflows: WorkflowDefinition[]): WorkflowDefinition[];

  /** List all registered workflows */
  listWorkflows(): WorkflowDefinition[];

  /** Execute a workflow
   *
   * @param workflowName - Name of workflow to execute
   * @param context - Execution context
   * @param actions - Action handlers (action name -> handler function)
   * @returns Execution result
   */
  execute(
    workflowName: string,
    context: WorkflowContext,
    actions: Record<string, ActionHandler>,
  ): Promise<WorkflowExecutionResult>;

  /** Get execution history for a workflow */
  getHistory(workflowName: string): WorkflowHistoryEntry[];

  /** Get all workflow history */
  getAllHistory(): WorkflowHistoryEntry[];
}

/** Internal workflow execution record */
interface WorkflowExecution {
  id: string;
  workflow: WorkflowDefinition;
  context: WorkflowContext;
  startTime: number;
  status: WorkflowStatus;
  executedSteps: number;
  currentStep: number;
  error?: string;
  lastResult?: unknown;
}

/** Create a workflow engine */
export function createWorkflowEngine(): WorkflowEngine {
  const workflows = new Map<string, WorkflowDefinition>();
  const history: Map<string, WorkflowHistoryEntry[]> = new Map();

  function register(workflowDefs: WorkflowDefinition[]): WorkflowDefinition[] {
    for (const workflow of workflowDefs) {
      workflows.set(workflow.name, workflow);
      // Initialize history array
      if (!history.has(workflow.name)) {
        history.set(workflow.name, []);
      }
    }
    return workflowDefs;
  }

  function listWorkflows(): WorkflowDefinition[] {
    return Array.from(workflows.values());
  }

  async function execute(
    workflowName: string,
    context: WorkflowContext,
    actions: Record<string, ActionHandler>,
  ): Promise<WorkflowExecutionResult> {
    const workflow = workflows.get(workflowName);
    if (!workflow) {
      return {
        status: "failed",
        executedSteps: 0,
        error: `Workflow not found: ${workflowName}`,
        duration: 0,
      };
    }

    const startTime = Date.now();
    const executionId = `exec-${Date.now()}-${Math.random().toString(36).slice(2)}`;

    const execution: WorkflowExecution = {
      id: executionId,
      workflow,
      context,
      startTime,
      status: "running",
      executedSteps: 0,
      currentStep: 0,
    };

    let previousResult: unknown = undefined;
    const stepResults: unknown[] = [];
    let stepsExecuted = 0;

    try {
      for (let i = 0; i < workflow.steps.length; i++) {
        const step = workflow.steps[i];
        execution.currentStep = i;

        // Check conditional execution
        if (step.if && !evaluateCondition(step.if, previousResult, context)) {
          continue; // Skip this step
        }

        // Check if async step
        if (step.async) {
          // Queue for async execution
          queueAsyncStep(workflowName, executionId, step, context, actions, previousResult);
          execution.status = "async";
          execution.executedSteps = stepsExecuted;
          break;
        }

        // Update executed steps count before executing (for error tracking)
        execution.executedSteps = stepsExecuted;

        // Execute step with retry logic
        const result = await executeStepWithRetry(step, context, actions, previousResult);
        previousResult = result;
        stepResults.push(result);
        stepsExecuted++;
        execution.executedSteps = stepsExecuted;
      }

      if (execution.status !== "async") {
        execution.status = "completed";
      }
    } catch (error) {
      execution.status = "failed";
      execution.error = error instanceof Error ? error.message : String(error);

      // Log error with plugin and handler name
      const pluginName = workflow.plugin || "unknown";
      const stepName = workflow.steps[execution.currentStep]?.action || "unknown";
      context.logger.error(
        `[${pluginName}] Workflow "${workflowName}" failed at step "${stepName}": ${execution.error}`,
      );
    }

    const duration = Date.now() - startTime;

    // Record history
    const historyEntry: WorkflowHistoryEntry = {
      id: executionId,
      workflowName: workflow.name,
      plugin: workflow.plugin,
      triggerEvent: workflow.trigger.event?.type,
      status: execution.status,
      startTime: new Date(startTime).toISOString(),
      duration,
      executedSteps: execution.executedSteps,
      totalSteps: workflow.steps.length,
      currentStep: execution.currentStep,
      error: execution.error,
      lastResult: execution.lastResult,
    };

    const workflowHistory = history.get(workflowName) || [];
    workflowHistory.push(historyEntry);
    history.set(workflowName, workflowHistory);

    return {
      status: execution.status,
      executedSteps: execution.executedSteps,
      error: execution.error,
      result: previousResult,
      duration,
    };
  }

  function getHistory(workflowName: string): WorkflowHistoryEntry[] {
    return history.get(workflowName) || [];
  }

  function getAllHistory(): WorkflowHistoryEntry[] {
    const allEntries: WorkflowHistoryEntry[] = [];
    for (const entries of history.values()) {
      allEntries.push(...entries);
    }
    return allEntries.sort((a, b) => b.startTime.localeCompare(a.startTime));
  }

  // Async step queue (in-memory for now)
  const asyncQueue: Array<{
    workflowName: string;
    executionId: string;
    step: WorkflowStep;
    context: WorkflowContext;
    actions: Record<string, ActionHandler>;
    previousResult: unknown;
  }> = [];

  function queueAsyncStep(
    workflowName: string,
    executionId: string,
    step: WorkflowStep,
    context: WorkflowContext,
    actions: Record<string, ActionHandler>,
    previousResult: unknown,
  ): void {
    asyncQueue.push({
      workflowName,
      executionId,
      step,
      context,
      actions,
      previousResult,
    });

    // Process async queue (in production, this would be a proper background job)
    processAsyncQueue();
  }

  async function processAsyncQueue(): Promise<void> {
    while (asyncQueue.length > 0) {
      const item = asyncQueue.shift()!;
      try {
        const result = await executeStepWithRetry(
          item.step,
          item.context,
          item.actions,
          item.previousResult,
        );

        // Log completion
        item.context.logger.info(
          `[Async] Workflow "${item.workflowName}" step "${item.step.action}" completed`,
        );

        // Update history if needed
        const workflowHistory = history.get(item.workflowName);
        if (workflowHistory) {
          const lastEntry = workflowHistory[workflowHistory.length - 1];
          if (lastEntry && lastEntry.id === item.executionId) {
            lastEntry.lastResult = result;
            lastEntry.executedSteps++;
          }
        }
      } catch (error) {
        item.context.logger.error(
          `[Async] Workflow "${item.workflowName}" step "${item.step.action}" failed: ${error}`,
        );
      }
    }
  }

  async function executeStepWithRetry(
    step: WorkflowStep,
    context: WorkflowContext,
    actions: Record<string, ActionHandler>,
    previousResult?: unknown,
  ): Promise<unknown> {
    const action = actions[step.action];
    if (!action) {
      throw new Error(`Action not found: ${step.action}`);
    }

    const maxAttempts = step.retry?.maxAttempts ?? 1;
    const delay = step.retry?.delay ?? 1000;
    const backoffMultiplier = step.retry?.backoffMultiplier ?? 2;

    let lastError: Error | undefined;

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      try {
        return await action({
          data: context.data,
          previousResult,
          step,
        });
      } catch (error) {
        lastError = error as Error;

        if (attempt < maxAttempts - 1) {
          const waitDelay = delay * Math.pow(backoffMultiplier, attempt);
          context.logger.warn(
            `[Retry] Step "${step.action}" failed (attempt ${attempt + 1}/${maxAttempts}), retrying in ${waitDelay}ms`,
          );
          await new Promise((resolve) => setTimeout(resolve, waitDelay));
        }
      }
    }

    throw lastError;
  }

  function evaluateCondition(
    condition: ConditionalExpression,
    previousResult: unknown,
    context: WorkflowContext,
  ): boolean {
    let fieldValue: unknown;

    // Extract field value from previous result or context
    if (condition.field.startsWith("previousResult.")) {
      const path = condition.field.slice("previousResult.".length);
      fieldValue = getValueByPath(previousResult, path);
    } else if (condition.field.startsWith("context.")) {
      const path = condition.field.slice("context.".length);
      fieldValue = getValueByPath(context, path);
    } else if (condition.field === "previousResult") {
      fieldValue = previousResult;
    } else {
      fieldValue = getValueByPath(context, condition.field);
    }

    // For context.data, check the data context
    if (condition.field.startsWith("context.data.") && context.data) {
      const dataPath = condition.field.slice("context.data.".length);
      fieldValue = getValueByPath(context.data, dataPath);
    }

    // Evaluate based on operator
    switch (condition.operator) {
      case "eq":
        return fieldValue === condition.value;
      case "ne":
        return fieldValue !== condition.value;
      case "gt":
        return typeof fieldValue === "number" && fieldValue > (condition.value as number);
      case "gte":
        return typeof fieldValue === "number" && fieldValue >= (condition.value as number);
      case "lt":
        return typeof fieldValue === "number" && fieldValue < (condition.value as number);
      case "lte":
        return typeof fieldValue === "number" && fieldValue <= (condition.value as number);
      case "contains":
        return typeof fieldValue === "string" && fieldValue.includes(condition.value as string);
      case "exists":
        return fieldValue !== undefined && fieldValue !== null;
      case "truthy":
        return !!fieldValue;
      default:
        return false;
    }
  }

  function getValueByPath(obj: unknown, path: string): unknown {
    if (path === "") return obj;

    const parts = path.split(".");
    let current: unknown = obj;

    for (const part of parts) {
      if (current && typeof current === "object" && current !== null) {
        current = (current as Record<string, unknown>)[part];
      } else {
        return undefined;
      }
    }

    return current;
  }

  return {
    register,
    listWorkflows,
    execute,
    getHistory,
    getAllHistory,
  };
}
