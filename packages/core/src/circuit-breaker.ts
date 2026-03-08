/**
 * Circuit Breaker — State machine for preventing cascading failures
 *
 * Provides:
 * - CLOSED → OPEN → HALF-OPEN → CLOSED state transitions
 * - Configurable failure threshold and open duration
 * - Automatic state recovery after timeout
 * - Statistics tracking
 * - State transition logging
 * - Notification callbacks
 *
 * Thread Safety: This implementation is designed for single-threaded Node.js environments.
 * In multi-threaded environments, state mutations should be protected with mutexes.
 */

/** Default failure threshold (number of failures before opening) */
const DEFAULT_FAILURE_THRESHOLD = 5;

/** Default open duration in milliseconds (30 seconds) */
const DEFAULT_OPEN_DURATION_MS = 30000;

/** Circuit breaker states */
export type CircuitBreakerState = "closed" | "open" | "half-open";

export interface CircuitBreakerConfig {
  /** Number of failures before opening (default: 5) */
  failureThreshold?: number;
  /** Duration to stay open in milliseconds (default: 30000ms) */
  openDurationMs?: number;
  /** Optional logger for state transitions */
  logger?: Pick<Console, "log" | "warn" | "error" | "info">;
  /** Optional callback when state transitions */
  onStateChange?: (oldState: CircuitBreakerState, newState: CircuitBreakerState) => void;
}

export interface CircuitBreakerDeps {
  config?: Partial<CircuitBreakerConfig>;
}

export interface CircuitBreaker {
  /** Get current state */
  getState(): CircuitBreakerState;
  /** Record a successful operation */
  recordSuccess(): void;
  /** Record a failed operation */
  recordFailure(): void;
  /** Check if requests should be allowed */
  allowRequest(): boolean;
  /** Get current failure count */
  getFailureCount(): number;
  /** Get timestamp of last failure */
  getLastFailureTime(): number | undefined;
  /** Get timestamp when circuit opened */
  getOpenedAt(): number | undefined;
  /** Reset to initial state */
  reset(): void;
  /** Get formatted state description */
  getFormattedState(): string;
  /** Get time remaining until breaker closes (if open) */
  getTimeUntilClose(): number | undefined;
}

/**
 * Create circuit breaker with configuration
 */
export function createCircuitBreaker(deps: CircuitBreakerDeps = {}): CircuitBreaker {
  const failureThreshold = deps.config?.failureThreshold ?? DEFAULT_FAILURE_THRESHOLD;
  const openDurationMs = deps.config?.openDurationMs ?? DEFAULT_OPEN_DURATION_MS;
  const logger = deps.config?.logger ?? console;
  const onStateChange = deps.config?.onStateChange;

  return new CircuitBreakerImpl({
    failureThreshold,
    openDurationMs,
    logger,
    onStateChange,
  });
}

class CircuitBreakerImpl implements CircuitBreaker {
  private state: CircuitBreakerState;
  private failureCount: number;
  private lastFailureTime: number | undefined;
  private openedAt: number | undefined;
  private readonly failureThreshold: number;
  private readonly openDurationMs: number;
  private readonly logger: Pick<Console, "log" | "warn" | "error" | "info">;
  private readonly onStateChange?: (
    oldState: CircuitBreakerState,
    newState: CircuitBreakerState,
  ) => void;

  constructor(config: {
    failureThreshold: number;
    openDurationMs: number;
    logger: Pick<Console, "log" | "warn" | "error" | "info">;
    onStateChange?: (oldState: CircuitBreakerState, newState: CircuitBreakerState) => void;
  }) {
    this.failureThreshold = config.failureThreshold;
    this.openDurationMs = config.openDurationMs;
    this.logger = config.logger;
    this.onStateChange = config.onStateChange;
    this.state = "closed";
    this.failureCount = 0;
    this.lastFailureTime = undefined;
    this.openedAt = undefined;
  }

  private setState(newState: CircuitBreakerState): void {
    if (this.state !== newState) {
      const oldState = this.state;
      this.state = newState;
      this.logger.info(`CircuitBreaker: ${oldState.toUpperCase()} → ${newState.toUpperCase()}`);
      this.onStateChange?.(oldState, newState);
    }
  }

  getState(): CircuitBreakerState {
    // Auto-transition from OPEN to HALF-OPEN after openDurationMs
    if (this.state === "open" && this.openedAt !== undefined) {
      const now = Date.now();
      if (now - this.openedAt >= this.openDurationMs) {
        this.setState("half-open");
        // Don't reset openedAt - we keep it for statistics
      }
    }
    return this.state;
  }

  recordSuccess(): void {
    if (this.state === "half-open") {
      // Transition to CLOSED on success
      this.setState("closed");
      this.failureCount = 0;
      this.openedAt = undefined;
    } else if (this.state === "closed") {
      // Reset failure count on success
      this.failureCount = 0;
    }
    // In OPEN state, success is ignored (circuit is still open)
  }

  recordFailure(): void {
    this.lastFailureTime = Date.now();

    if (this.state === "open") {
      // Already open, don't track failures
      return;
    }

    if (this.state === "half-open") {
      // Transition back to OPEN immediately on failure
      this.setState("open");
      this.openedAt = Date.now();
      // Reset failure count since we're opening again
      this.failureCount = 0;
      return;
    }

    // CLOSED state
    this.failureCount++;
    if (this.failureCount >= this.failureThreshold) {
      // Transition to OPEN
      this.setState("open");
      this.openedAt = Date.now();
    }
  }

  allowRequest(): boolean {
    const state = this.getState();
    return state === "closed" || state === "half-open";
  }

  getFailureCount(): number {
    return this.failureCount;
  }

  getLastFailureTime(): number | undefined {
    return this.lastFailureTime;
  }

  getOpenedAt(): number | undefined {
    return this.openedAt;
  }

  reset(): void {
    this.setState("closed");
    this.failureCount = 0;
    this.lastFailureTime = undefined;
    this.openedAt = undefined;
  }

  getFormattedState(): string {
    const state = this.getState();
    if (state !== "open") {
      return `${state.toUpperCase()}: Circuit breaker is ${state}`;
    }

    // OPEN state: show time elapsed and remaining
    if (this.openedAt === undefined) {
      return "OPEN: Circuit breaker is open";
    }

    const now = Date.now();
    const elapsed = now - this.openedAt;
    const remaining = this.openDurationMs - elapsed;

    return `OPEN: Circuit breaker opened ${Math.round(elapsed / 1000)}s ago, closes in ${Math.round(
      Math.max(0, remaining / 1000),
    )}s`;
  }

  getTimeUntilClose(): number | undefined {
    const state = this.getState();
    if (state !== "open" || this.openedAt === undefined) {
      return undefined;
    }

    const now = Date.now();
    const remaining = this.openDurationMs - (now - this.openedAt);
    return Math.max(0, remaining);
  }
}
