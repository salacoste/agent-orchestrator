/**
 * Retry Service — Retry operations with exponential backoff
 *
 * Provides:
 * - Exponential backoff: 1s, 2s, 4s, 8s, 16s
 * - Configurable max attempts and backoff limits
 * - Retry logging
 * - Non-retryable error detection
 * - Jitter to prevent thundering herd
 */

/** Default max retry attempts */
const DEFAULT_MAX_ATTEMPTS = 7;

/** Default initial backoff in milliseconds */
const DEFAULT_INITIAL_BACKOFF_MS = 1000;

/** Default max backoff in milliseconds */
const DEFAULT_MAX_BACKOFF_MS = 60000;

/** Default jitter percentage (10%) */
const DEFAULT_JITTER_PERCENT = 0.1;

export interface RetryServiceConfig {
  /** Maximum number of retry attempts (default: 7) */
  maxAttempts?: number;
  /** Initial backoff delay in milliseconds (default: 1000ms) */
  initialBackoffMs?: number;
  /** Maximum backoff delay in milliseconds (default: 60000ms) */
  maxBackoffMs?: number;
  /** Jitter percentage for backoff (default: 0.1 = 10%) */
  jitterPercent?: number;
}

export interface RetryServiceDeps {
  config?: Partial<RetryServiceConfig>;
}

export interface RetryService {
  /** Execute an operation with retry logic */
  execute<T>(operation: () => Promise<T>, options?: RetryOptions): Promise<T>;
}

export interface RetryOptions {
  /** Function to determine if an error is retryable */
  isRetryable?: (error: Error) => boolean;
  /** Operation name for logging */
  operationName?: string;
  /** Override max attempts */
  maxAttempts?: number;
  /** Logger for retry attempts (defaults to console) */
  logger?: Pick<Console, "log" | "error" | "warn" | "info">;
}

/** Retry history entry */
export interface RetryHistoryEntry {
  /** Attempt number */
  attempt: number;
  /** Error message */
  error: string;
  /** Delay before next retry (ms) */
  delay: number;
}

/** Error with retry history attached */
export interface RetryError extends Error {
  /** Original error that caused retry failure */
  cause?: Error;
  /** History of retry attempts */
  retryHistory: RetryHistoryEntry[];
}

/**
 * Create retry service with configuration
 */
export function createRetryService(deps: RetryServiceDeps = {}): RetryService {
  const maxAttempts = deps.config?.maxAttempts ?? DEFAULT_MAX_ATTEMPTS;
  const initialBackoffMs = deps.config?.initialBackoffMs ?? DEFAULT_INITIAL_BACKOFF_MS;
  const maxBackoffMs = deps.config?.maxBackoffMs ?? DEFAULT_MAX_BACKOFF_MS;
  const jitterPercent = deps.config?.jitterPercent ?? DEFAULT_JITTER_PERCENT;

  return new RetryServiceImpl({
    maxAttempts,
    initialBackoffMs,
    maxBackoffMs,
    jitterPercent,
  });
}

class RetryServiceImpl implements RetryService {
  private maxAttempts: number;
  private initialBackoffMs: number;
  private maxBackoffMs: number;
  private jitterPercent: number;

  constructor(config: {
    maxAttempts: number;
    initialBackoffMs: number;
    maxBackoffMs: number;
    jitterPercent: number;
  }) {
    this.maxAttempts = config.maxAttempts;
    this.initialBackoffMs = config.initialBackoffMs;
    this.maxBackoffMs = config.maxBackoffMs;
    this.jitterPercent = config.jitterPercent;
  }

  async execute<T>(operation: () => Promise<T>, options: RetryOptions = {}): Promise<T> {
    const {
      isRetryable = () => true,
      operationName = "operation",
      maxAttempts = this.maxAttempts,
      logger = console,
    } = options;

    let lastError: Error | null = null;
    const retryHistory: { attempt: number; error: string; delay: number }[] = [];

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error as Error;
        retryHistory.push({
          attempt: attempt + 1,
          error: lastError.message,
          delay: 0,
        });

        // Check if this is the last attempt or if error is not retryable
        if (attempt === maxAttempts - 1 || !isRetryable(lastError)) {
          // Log non-retryable error with DLQ indicator
          if (!isRetryable(lastError)) {
            logger.error(
              `Non-retryable error: ${lastError.constructor.name} - ${lastError.message}`,
            );
          }
          // Throw with full retry context
          const retryError = new Error(
            `Operation failed after ${attempt + 1} attempt(s): ${lastError.message}`,
          ) as RetryError;
          retryError.cause = lastError;
          retryError.retryHistory = retryHistory;
          throw retryError;
        }

        // Calculate base backoff delay: 2^attempt * initialBackoffMs
        const baseDelay = Math.min(this.initialBackoffMs * Math.pow(2, attempt), this.maxBackoffMs);

        // Add jitter to prevent thundering herd: ±jitterPercent
        const jitter = baseDelay * this.jitterPercent * (Math.random() * 2 - 1);
        const delay = Math.max(0, baseDelay + jitter);

        retryHistory[retryHistory.length - 1].delay = delay;

        // Log retry attempt
        logger.log(
          `Retry attempt ${attempt + 1}/${maxAttempts} for ${operationName} after ${Math.round(delay)}ms`,
        );

        // Wait before retry
        await this.delay(delay);
      }
    }

    throw lastError;
  }

  /**
   * Delay for specified milliseconds
   */
  private async delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
