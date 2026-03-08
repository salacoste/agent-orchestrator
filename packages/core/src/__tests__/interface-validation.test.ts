/**
 * Unit Tests: Interface Validation Helpers
 *
 * Tests for interface validation, method signature checking, and feature flag patterns.
 */

import { describe, it, expect } from "vitest";
import {
  validateInterfaceMethod,
  validateMethodSignature,
  createFeatureFlagCheck,
  generateFeatureFlagDocumentation,
  hasInterfaceMethod,
  type FeatureFlagConfig,
} from "../interface-validation.js";

describe("Interface Validation Helpers", () => {
  describe("validateInterfaceMethod", () => {
    it("should return valid when method exists on interface", () => {
      // Given: An interface with a method
      interface TestInterface {
        existingMethod(): Promise<void>;
      }
      const testObj = {
        existingMethod: async () => {},
      } as TestInterface;

      // When: Validating the existing method
      const result = validateInterfaceMethod(
        testObj as unknown as Record<string, unknown>,
        "existingMethod",
      );

      // Then: Should return valid result
      expect(result.valid).toBe(true);
      expect(result.methodName).toBe("existingMethod");
      expect(result.exists).toBe(true);
    });

    it("should return validation result for non-existent method", () => {
      // Given: An interface without a specific method
      interface TestInterface {
        existingMethod(): Promise<void>;
      }
      const testObj = {
        existingMethod: async () => {},
      } as TestInterface;

      // When: Validating a non-existent method
      const result = validateInterfaceMethod(
        testObj as unknown as Record<string, unknown>,
        "nonExistentMethod",
      );

      // Then: Should return validation result with method not existing
      // Note: valid=true means validation succeeded (we have info about the method)
      // exists=false means the method is not available to call
      expect(result.valid).toBe(true);
      expect(result.methodName).toBe("nonExistentMethod");
      expect(result.exists).toBe(false);
      expect(result.isOptional).toBe(true); // Missing methods assumed optional
    });

    it("should detect optional methods", () => {
      // Given: An interface with an optional method
      interface TestInterface {
        optionalMethod?: () => void;
      }
      const testObj = {} as TestInterface;

      // When: Validating the optional method
      const result = validateInterfaceMethod(
        testObj as unknown as Record<string, unknown>,
        "optionalMethod",
      );

      // Then: Should indicate it's optional
      expect(result.valid).toBe(true);
      expect(result.exists).toBe(false);
      expect(result.isOptional).toBe(true);
    });
  });

  describe("validateMethodSignature", () => {
    it("should validate matching method signatures", () => {
      // Given: A method with specific signature
      const method = (_a: string, _b: number): Promise<void> => Promise.resolve();

      // When: Validating with correct signature
      const result = validateMethodSignature(method as (..._args: unknown[]) => unknown, {
        parameters: [
          { name: "a", type: "string" },
          { name: "b", type: "number" },
        ],
        returnType: "Promise<void>",
      });

      // Then: Should be valid
      expect(result.valid).toBe(true);
    });

    it("should detect parameter count mismatch", () => {
      // Given: A method with 2 parameters
      const method = (_a: string, _b: number): Promise<void> => Promise.resolve();

      // When: Validating with 3 parameters
      const result = validateMethodSignature(method as (..._args: unknown[]) => unknown, {
        parameters: [
          { name: "a", type: "string" },
          { name: "b", type: "number" },
          { name: "c", type: "boolean" },
        ],
        returnType: "Promise<void>",
      });

      // Then: Should be invalid
      expect(result.valid).toBe(false);
      expect(result.errors).toContain("Parameter count mismatch: expected 3, got 2");
    });

    it("should note return type validation limitation", () => {
      // Given: A method returning Promise<void>
      const method = (): Promise<void> => Promise.resolve();

      // When: Validating with string return type
      const result = validateMethodSignature(method as (..._args: unknown[]) => unknown, {
        parameters: [],
        returnType: "string",
      });

      // Then: Should pass parameter count but note type validation limitation
      // Note: Runtime return type validation is not possible due to type erasure
      // This is primarily for compile-time documentation
      expect(result.valid).toBe(true);
      expect(result.errors.length).toBe(0);
    });
  });

  describe("createFeatureFlagCheck", () => {
    it("should create feature flag check for optional method", () => {
      // Given: An optional method
      interface TestInterface {
        optionalMethod?: () => string;
      }
      const testObj = {} as TestInterface;

      // When: Creating feature flag check
      const check = createFeatureFlagCheck(
        testObj as unknown as Record<string, unknown>,
        "optionalMethod",
        {
          flagName: "TEST_OPTIONAL_FEATURE",
          limitation: "Requires TestInterface.optionalMethod() enhancement",
          epic: "Deferred to Epic 4",
        },
      );

      // Then: Should return feature flag config
      expect(check.hasFeature).toBe(false);
      expect(check.flagName).toBe("TEST_OPTIONAL_FEATURE");
      expect(check.limitation).toBe("Requires TestInterface.optionalMethod() enhancement");
      expect(check.epic).toBe("Deferred to Epic 4");
    });

    it("should return hasFeature true when method exists", () => {
      // Given: An interface with an optional method that exists
      interface TestInterface {
        optionalMethod?: () => string;
      }
      const testObj = {
        optionalMethod: () => "test",
      } as TestInterface;

      // When: Creating feature flag check
      const check = createFeatureFlagCheck(
        testObj as unknown as Record<string, unknown>,
        "optionalMethod",
        {
          flagName: "TEST_OPTIONAL_FEATURE",
          limitation: "Requires TestInterface.optionalMethod() enhancement",
        },
      );

      // Then: Should indicate feature is available
      expect(check.hasFeature).toBe(true);
    });
  });

  describe("generateFeatureFlagDocumentation", () => {
    it("should generate documentation with all fields", () => {
      // Given: Feature flag config with epic
      const config: FeatureFlagConfig = {
        flagName: "RUNTIME_EXIT_CODE_DETECTION",
        limitation: "Requires Runtime.getExitCode() enhancement",
        epic: "Deferred to Epic 4",
      };

      // When: Generating documentation using helper function
      const doc = generateFeatureFlagDocumentation(config);

      // Then: Should have proper format with all fields
      expect(doc).toContain("**Limitation:** Requires Runtime.getExitCode() enhancement");
      expect(doc).toContain("**Feature Flag:** RUNTIME_EXIT_CODE_DETECTION");
      expect(doc).toContain(
        "**Tracking:** sprint-status.yaml → limitations.runtime-exit-code-detection",
      );
      expect(doc).toContain("**Epic:** Deferred to Epic 4");
    });

    it("should generate documentation without epic field", () => {
      // Given: Feature flag config without epic
      const config: FeatureFlagConfig = {
        flagName: "SOME_FEATURE",
        limitation: "Requires some enhancement",
      };

      // When: Generating documentation
      const doc = generateFeatureFlagDocumentation(config);

      // Then: Should not include epic line
      expect(doc).toContain("**Limitation:** Requires some enhancement");
      expect(doc).toContain("**Feature Flag:** SOME_FEATURE");
      expect(doc).not.toContain("**Epic:**");
    });

    it("should convert flag name to tracking key format", () => {
      // Given: Flag name with underscores and uppercase
      const config: FeatureFlagConfig = {
        flagName: "RUNTIME_EXIT_CODE_DETECTION",
        limitation: "Test",
      };

      // When: Generating documentation
      const doc = generateFeatureFlagDocumentation(config);

      // Then: Should convert to lowercase with hyphens
      expect(doc).toContain("runtime-exit-code-detection");
    });
  });

  describe("hasInterfaceMethod", () => {
    it("should return true when method exists and is function", () => {
      // Given: Object with existing method
      const testObj = {
        existingMethod: () => "test",
      };

      // When: Checking if method exists
      const result = hasInterfaceMethod(testObj, "existingMethod");

      // Then: Should return true
      expect(result).toBe(true);
    });

    it("should return false when method does not exist", () => {
      // Given: Object without the method
      const testObj = {
        otherMethod: () => "test",
      };

      // When: Checking for non-existent method
      const result = hasInterfaceMethod(testObj, "nonExistentMethod");

      // Then: Should return false
      expect(result).toBe(false);
    });

    it("should return false when property exists but is not a function", () => {
      // Given: Object with non-function property
      const testObj = {
        notAMethod: "string value",
      };

      // When: Checking if property is a method
      const result = hasInterfaceMethod(testObj, "notAMethod");

      // Then: Should return false
      expect(result).toBe(false);
    });

    it("should work as type guard", () => {
      // Given: Object with optional method
      const testObj: Record<string, unknown> = {
        optionalMethod: () => "test",
      };

      // When: Using as type guard
      if (hasInterfaceMethod(testObj, "optionalMethod")) {
        // Then: TypeScript should know method is callable
        const result = testObj.optionalMethod();
        expect(result).toBe("test");
      } else {
        // This branch should not execute
        expect(true).toBe(false);
      }
    });
  });

  describe("FeatureFlagConfig", () => {
    it("should support type with optional epic", () => {
      // Given: Config without epic field
      const config: FeatureFlagConfig = {
        flagName: "TEST_FEATURE",
        limitation: "Test limitation",
      };

      // Then: Should be valid type
      expect(config.flagName).toBe("TEST_FEATURE");
      expect(config.limitation).toBe("Test limitation");
      expect(config.epic).toBeUndefined();
    });
  });

  describe("Interface validation patterns", () => {
    it("should support optional chaining pattern for optional methods", () => {
      // Given: An interface with optional method
      interface TestInterface {
        optionalMethod?: () => string;
      }
      const testObj: TestInterface = {};

      // When: Using optional chaining pattern
      const result = testObj.optionalMethod?.();

      // Then: Should return undefined without error
      expect(result).toBeUndefined();
    });

    it("should support feature flag pattern with guard", () => {
      // Given: An interface with optional method
      interface TestInterface {
        optionalMethod?: () => string;
      }
      const testObj: TestInterface = {};

      // When: Using feature flag pattern
      if (!testObj.optionalMethod) {
        const limitation = "Feature not available";
        expect(limitation).toBe("Feature not available");
      }
    });
  });
});
