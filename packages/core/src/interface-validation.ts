/**
 * Interface Validation Helpers
 *
 * Provides utilities for validating interface methods, checking signatures,
 * and creating feature flag patterns for missing capabilities.
 *
 * Purpose: Prevent phantom method assumptions (like Epic 1's getExitCode issue)
 * by validating all interface dependencies before implementation.
 */

/**
 * Result of interface method validation
 */
export interface InterfaceValidationResult {
  /** Whether the method exists and is usable */
  valid: boolean;
  /** Name of the method being validated */
  methodName: string;
  /** Whether the method exists on the interface */
  exists: boolean;
  /** Whether the method is optional (?) */
  isOptional?: boolean;
  /** Error messages if validation failed */
  errors?: string[];
}

/**
 * Expected method signature for validation
 */
export interface MethodSignature {
  parameters: Array<{ name: string; type: string }>;
  returnType: string;
}

/**
 * Result of method signature validation
 */
export interface SignatureValidationResult {
  /** Whether the signature matches expectations */
  valid: boolean;
  /** Error messages describing mismatches */
  errors: string[];
}

/**
 * Feature flag configuration for missing capabilities
 */
export interface FeatureFlagConfig {
  /** Feature flag name (e.g., "RUNTIME_EXIT_CODE_DETECTION") */
  flagName: string;
  /** Human-readable limitation description */
  limitation: string;
  /** Epic where this is planned (optional) */
  epic?: string;
}

/**
 * Result of feature flag check
 */
export interface FeatureFlagCheck {
  /** Whether the feature/method is available */
  hasFeature: boolean;
  /** Feature flag name */
  flagName: string;
  /** Limitation description */
  limitation: string;
  /** Epic where this is planned (if applicable) */
  epic?: string;
}

/**
 * Validate that an interface method exists
 *
 * @param obj - Object to check for method
 * @param methodName - Name of the method to validate
 * @returns Validation result indicating if method exists
 *
 * @example
 * ```ts
 * const runtime: Runtime = getConfig().runtime;
 * const result = validateInterfaceMethod(runtime, "getExitCode");
 * if (!result.exists) {
 *   // Use feature flag pattern
 * }
 * ```
 */
export function validateInterfaceMethod<T extends Record<string, unknown>>(
  obj: T,
  methodName: string,
): InterfaceValidationResult {
  const exists = methodName in obj;
  const value = obj[methodName];

  // Check if it's an optional method (doesn't exist or exists but undefined)
  // At runtime, we can't distinguish between "required but missing" and "optional"
  // We assume missing methods are optional for validation purposes
  const isOptional = !exists || value === undefined;

  // valid means the validation check itself succeeded, not that the method exists
  // This allows developers to check if a method is optional vs required-missing
  const valid = true; // Validation always succeeds, we report what we found

  return {
    valid,
    methodName,
    exists: exists && value !== undefined && typeof value === "function",
    isOptional,
  };
}

/**
 * Validate method signature against expected signature
 *
 * Note: This is a compile-time validation helper. Runtime validation
 * is limited in TypeScript due to type erasure.
 *
 * @param method - Method to validate
 * @param expected - Expected signature
 * @returns Signature validation result
 *
 * @example
 * ```ts
 * const method = (a: string, b: number): Promise<void> => {};
 * const result = validateMethodSignature(method, {
 *   parameters: [
 *     { name: "a", type: "string" },
 *     { name: "b", type: "number" }
 *   ],
 *   returnType: "Promise<void>"
 * });
 * ```
 */
export function validateMethodSignature(
  method: (..._args: unknown[]) => unknown,
  expected: MethodSignature,
): SignatureValidationResult {
  const errors: string[] = [];

  // Get actual parameter count from function
  const actualParamCount = method.length;

  // Note: We can't validate parameter types at runtime due to TypeScript erasure
  // This is primarily for documentation and compile-time checks
  if (actualParamCount !== expected.parameters.length) {
    errors.push(
      `Parameter count mismatch: expected ${expected.parameters.length}, got ${actualParamCount}`,
    );
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Create a feature flag check for an optional method
 *
 * @param obj - Object to check for method
 * @param methodName - Name of the optional method
 * @param config - Feature flag configuration
 * @returns Feature flag check result
 *
 * @example
 * ```ts
 * const check = createFeatureFlagCheck(runtime, "getExitCode", {
 *   flagName: "RUNTIME_EXIT_CODE_DETECTION",
 *   limitation: "Requires Runtime.getExitCode() enhancement",
 *   epic: "Deferred to Epic 4"
 * });
 *
 * if (!check.hasFeature) {
 *   logger.warn(check.limitation);
 *   return null;
 * }
 * ```
 */
export function createFeatureFlagCheck<T extends Record<string, unknown>>(
  obj: T,
  methodName: string,
  config: FeatureFlagConfig,
): FeatureFlagCheck {
  const hasFeature = methodName in obj && obj[methodName] !== undefined;

  return {
    hasFeature,
    flagName: config.flagName,
    limitation: config.limitation,
    epic: config.epic,
  };
}

/**
 * Generate documentation string for a feature flag
 *
 * @param config - Feature flag configuration
 * @returns Markdown-formatted documentation
 *
 * @example
 * ```ts
 * const doc = generateFeatureFlagDocumentation({
 *   flagName: "RUNTIME_EXIT_CODE_DETECTION",
 *   limitation: "Requires Runtime.getExitCode() enhancement",
 *   epic: "Deferred to Epic 4"
 * });
 *
 * // Output:
 * // **Limitation:** Requires Runtime.getExitCode() enhancement
 * // **Feature Flag:** RUNTIME_EXIT_CODE_DETECTION
 * // **Tracking:** sprint-status.yaml → limitations.runtime-exit-code-detection
 * // **Epic:** Deferred to Epic 4
 * ```
 */
export function generateFeatureFlagDocumentation(config: FeatureFlagConfig): string {
  const trackingKey = config.flagName.toLowerCase().replace(/_/g, "-");

  return `**Limitation:** ${config.limitation}
**Feature Flag:** ${config.flagName}
**Tracking:** sprint-status.yaml → limitations.${trackingKey}
${config.epic ? `**Epic:** ${config.epic}` : ""}`;
}

/**
 * Check if an interface method is available before using it
 *
 * This is the preferred pattern for optional interface methods.
 *
 * @param obj - Object to check
 * @param methodName - Name of the method
 * @returns Type guard indicating method exists
 *
 * @example
 * ```ts
 * if (hasInterfaceMethod(runtime, "getExitCode")) {
 *   const exitCode = await runtime.getExitCode(handle);
 * } else {
 *   logger.warn("Exit code detection requires Runtime enhancement");
 *   return null;
 * }
 * ```
 */
export function hasInterfaceMethod<T extends Record<string, unknown>>(
  obj: T,
  methodName: string,
): obj is T & Record<typeof methodName, () => unknown> {
  return methodName in obj && typeof obj[methodName] === "function";
}
