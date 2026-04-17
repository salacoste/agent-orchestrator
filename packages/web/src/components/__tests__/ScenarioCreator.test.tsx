/**
 * ScenarioCreator component tests (Story 54.1, Task 4).
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";
import { ScenarioCreator, type ScenarioProjectInfo } from "../ScenarioCreator";

// Mock fetch for form submission
const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

const projects: ScenarioProjectInfo[] = [
  { id: "alpha", name: "Alpha", storyCounts: { total: 15, done: 5, inProgress: 3, backlog: 7 } },
  { id: "beta", name: "Beta", storyCounts: { total: 8, done: 2, inProgress: 1, backlog: 5 } },
  { id: "gamma", name: "Gamma", storyCounts: { total: 12, done: 8, inProgress: 0, backlog: 4 } },
];

const defaultOnCreated = vi.fn();

beforeEach(() => {
  vi.clearAllMocks();
  mockFetch.mockResolvedValue({
    ok: true,
    json: () => Promise.resolve({ id: "test-uuid", name: "Test", status: "draft" }),
  });
});

describe("ScenarioCreator", () => {
  it("renders name input and project checkboxes", () => {
    render(<ScenarioCreator projects={projects} onCreated={defaultOnCreated} />);

    expect(screen.getByLabelText("Scenario name")).toBeInTheDocument();
    expect(screen.getByText("Alpha")).toBeInTheDocument();
    expect(screen.getByText("Beta")).toBeInTheDocument();
    expect(screen.getByText("Gamma")).toBeInTheDocument();
  });

  it("shows project names with story counts", () => {
    render(<ScenarioCreator projects={projects} onCreated={defaultOnCreated} />);

    expect(screen.getByText(/15 stories/)).toBeInTheDocument();
    expect(screen.getByText(/8 stories/)).toBeInTheDocument();
    expect(screen.getByText(/12 stories/)).toBeInTheDocument();
  });

  it('"Select All" selects all projects', () => {
    render(<ScenarioCreator projects={projects} onCreated={defaultOnCreated} />);

    fireEvent.click(screen.getByText("Select All"));

    const checkboxes = screen.getAllByRole("checkbox");
    expect(checkboxes.every((cb) => (cb as HTMLInputElement).checked)).toBe(true);
  });

  it('"Deselect All" deselects all projects', () => {
    render(<ScenarioCreator projects={projects} onCreated={defaultOnCreated} />);

    // Select all first
    fireEvent.click(screen.getByText("Select All"));
    // Then deselect
    fireEvent.click(screen.getByText("Deselect All"));

    const checkboxes = screen.getAllByRole("checkbox");
    expect(checkboxes.every((cb) => (cb as HTMLInputElement).checked)).toBe(false);
  });

  it('"Create Scenario" button disabled when name empty', () => {
    render(<ScenarioCreator projects={projects} onCreated={defaultOnCreated} />);

    // Select a project but leave name empty
    fireEvent.click(screen.getByText("Alpha"));
    const submitButton = screen.getByText("Create Scenario");
    expect(submitButton).toBeDisabled();
  });

  it('"Create Scenario" button disabled when no projects selected', () => {
    render(<ScenarioCreator projects={projects} onCreated={defaultOnCreated} />);

    // Set a name but don't select projects
    fireEvent.change(screen.getByLabelText("Scenario name"), { target: { value: "Test" } });
    const submitButton = screen.getByText("Create Scenario");
    expect(submitButton).toBeDisabled();
  });

  it("shows validation error for empty name on blur", () => {
    render(<ScenarioCreator projects={projects} onCreated={defaultOnCreated} />);

    const nameInput = screen.getByLabelText("Scenario name");
    fireEvent.focus(nameInput);
    fireEvent.blur(nameInput);

    expect(screen.getByText("Scenario name is required")).toBeInTheDocument();
  });

  it("submitting calls onCreated callback with scenario data", async () => {
    const onCreated = vi.fn();
    render(<ScenarioCreator projects={projects} onCreated={onCreated} />);

    fireEvent.change(screen.getByLabelText("Scenario name"), { target: { value: "My Scenario" } });
    fireEvent.click(screen.getByText("Alpha"));
    await act(() => {
      fireEvent.click(screen.getByText("Create Scenario"));
    });

    await vi.waitFor(() => {
      expect(onCreated).toHaveBeenCalledWith(
        expect.objectContaining({ id: "test-uuid", status: "draft" }),
      );
    });
  });

  it("shows error message when API fails", async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      json: () => Promise.resolve({ error: "Server error" }),
    });

    render(<ScenarioCreator projects={projects} onCreated={defaultOnCreated} />);

    fireEvent.change(screen.getByLabelText("Scenario name"), { target: { value: "Test" } });
    fireEvent.click(screen.getByText("Alpha"));
    await act(() => {
      fireEvent.click(screen.getByText("Create Scenario"));
    });

    await vi.waitFor(() => {
      expect(screen.getByText("Server error")).toBeInTheDocument();
    });
  });

  it("toggles individual project checkbox on click", () => {
    render(<ScenarioCreator projects={projects} onCreated={defaultOnCreated} />);

    const alphaCheckbox = screen.getAllByRole("checkbox")[0] as HTMLInputElement;
    expect(alphaCheckbox.checked).toBe(false);

    fireEvent.click(alphaCheckbox);
    expect(alphaCheckbox.checked).toBe(true);

    fireEvent.click(alphaCheckbox);
    expect(alphaCheckbox.checked).toBe(false);
  });

  it("enables submit when name and project are both set", () => {
    render(<ScenarioCreator projects={projects} onCreated={defaultOnCreated} />);

    fireEvent.change(screen.getByLabelText("Scenario name"), { target: { value: "My Scenario" } });
    fireEvent.click(screen.getByText("Alpha"));

    expect(screen.getByText("Create Scenario")).not.toBeDisabled();
  });

  it("shows loading state during submission", async () => {
    // Create a promise we control
    let resolveResponse: (value: unknown) => void;
    mockFetch.mockReturnValue(
      new Promise((resolve) => {
        resolveResponse = resolve;
      }),
    );

    render(<ScenarioCreator projects={projects} onCreated={defaultOnCreated} />);

    fireEvent.change(screen.getByLabelText("Scenario name"), { target: { value: "Test" } });
    fireEvent.click(screen.getByText("Alpha"));
    await act(() => {
      fireEvent.click(screen.getByText("Create Scenario"));
    });

    expect(screen.getByText("Creating...")).toBeInTheDocument();

    // Resolve the fetch
    resolveResponse!({
      ok: true,
      json: () => Promise.resolve({ id: "test", name: "Test", status: "draft" }),
    });

    await vi.waitFor(() => {
      expect(screen.queryByText("Creating...")).not.toBeInTheDocument();
    });
  });
});
