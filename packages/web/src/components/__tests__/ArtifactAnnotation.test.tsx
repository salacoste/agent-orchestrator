/**
 * ArtifactAnnotation component tests (Story 42.1).
 */
import { describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ArtifactAnnotation } from "../ArtifactAnnotation";
import type { Annotation } from "@/lib/workflow/collaboration";

function makeAnnotation(overrides: Partial<Annotation> = {}): Annotation {
  return {
    id: "annotation-1",
    artifactId: "prd.md",
    author: "Alice",
    text: "Looks good",
    timestamp: "2026-03-22T00:00:00Z",
    ...overrides,
  };
}

describe("ArtifactAnnotation", () => {
  it("renders existing annotations", () => {
    render(
      <ArtifactAnnotation
        artifactId="prd.md"
        annotations={[
          makeAnnotation({ id: "a-1", author: "Alice", text: "First comment" }),
          makeAnnotation({ id: "a-2", author: "Bob", text: "Second comment" }),
        ]}
      />,
    );

    expect(screen.getByText("Alice")).toBeInTheDocument();
    expect(screen.getByText("First comment")).toBeInTheDocument();
    expect(screen.getByText("Bob")).toBeInTheDocument();
    expect(screen.getByText("Second comment")).toBeInTheDocument();
  });

  it("shows 'Add comment' button when onAdd is provided", () => {
    render(<ArtifactAnnotation artifactId="prd.md" annotations={[]} onAdd={vi.fn()} />);

    expect(screen.getByTestId("add-annotation-button")).toBeInTheDocument();
  });

  it("does not show 'Add comment' button when onAdd is not provided", () => {
    render(<ArtifactAnnotation artifactId="prd.md" annotations={[]} />);

    expect(screen.queryByTestId("add-annotation-button")).not.toBeInTheDocument();
  });

  it("expands input on 'Add comment' click", () => {
    render(<ArtifactAnnotation artifactId="prd.md" annotations={[]} onAdd={vi.fn()} />);

    fireEvent.click(screen.getByTestId("add-annotation-button"));

    expect(screen.getByTestId("annotation-input")).toBeInTheDocument();
    expect(screen.getByTestId("annotation-text-input")).toBeInTheDocument();
  });

  it("calls onAdd with correct data on submit", () => {
    const onAdd = vi.fn();
    render(
      <ArtifactAnnotation artifactId="prd.md" annotations={[]} onAdd={onAdd} currentUser="Alice" />,
    );

    fireEvent.click(screen.getByTestId("add-annotation-button"));
    fireEvent.change(screen.getByTestId("annotation-text-input"), {
      target: { value: "Great work!" },
    });
    fireEvent.click(screen.getByTestId("annotation-submit"));

    expect(onAdd).toHaveBeenCalledWith({
      artifactId: "prd.md",
      author: "Alice",
      text: "Great work!",
    });
  });

  it("collapses input on cancel", () => {
    render(<ArtifactAnnotation artifactId="prd.md" annotations={[]} onAdd={vi.fn()} />);

    fireEvent.click(screen.getByTestId("add-annotation-button"));
    expect(screen.getByTestId("annotation-input")).toBeInTheDocument();

    fireEvent.click(screen.getByTestId("annotation-cancel"));
    expect(screen.queryByTestId("annotation-input")).not.toBeInTheDocument();
  });

  it("submit button is disabled when text is empty", () => {
    render(<ArtifactAnnotation artifactId="prd.md" annotations={[]} onAdd={vi.fn()} />);

    fireEvent.click(screen.getByTestId("add-annotation-button"));

    const submitBtn = screen.getByTestId("annotation-submit");
    expect(submitBtn).toBeDisabled();
  });
});
