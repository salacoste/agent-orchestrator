/**
 * Agent Orchestrator VS Code Extension (Stories 35.1 + 35.2).
 *
 * Provides sidebar panels for sprint status, agent monitoring,
 * and workflow recommendations directly in the editor.
 */
import * as vscode from "vscode";

export function activate(context: vscode.ExtensionContext): void {
  // Register tree data providers for sidebar panels
  const sprintProvider = new SprintTreeProvider();
  vscode.window.registerTreeDataProvider("ao-sprint", sprintProvider);

  const agentProvider = new AgentTreeProvider();
  vscode.window.registerTreeDataProvider("ao-agents", agentProvider);

  // Register commands
  context.subscriptions.push(
    vscode.commands.registerCommand("ao.spawn", async () => {
      const storyId = await vscode.window.showInputBox({
        prompt: "Story ID to spawn agent for",
        placeHolder: "1-3-auth-module",
      });
      if (storyId) {
        vscode.window.showInformationMessage(`Spawning agent for story ${storyId}...`);
        // TODO: Call SDK ao.spawn({ storyId })
      }
    }),

    vscode.commands.registerCommand("ao.status", () => {
      sprintProvider.refresh();
      vscode.window.showInformationMessage("Sprint status refreshed");
    }),

    vscode.commands.registerCommand("ao.recommend", async () => {
      vscode.window.showInformationMessage("Fetching recommendation...");
      // TODO: Call SDK ao.recommend(projectId)
    }),
  );
}

export function deactivate(): void {
  // Cleanup
}

/**
 * Sprint sidebar tree data provider.
 */
class SprintTreeProvider implements vscode.TreeDataProvider<SprintItem> {
  private _onDidChangeTreeData = new vscode.EventEmitter<SprintItem | undefined>();
  readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

  refresh(): void {
    this._onDidChangeTreeData.fire(undefined);
  }

  getTreeItem(element: SprintItem): vscode.TreeItem {
    return element;
  }

  getChildren(): SprintItem[] {
    // TODO: Fetch from API via SDK
    return [
      new SprintItem("Sprint Progress", "5/10 stories done", vscode.TreeItemCollapsibleState.None),
      new SprintItem("Active Agents", "3 running", vscode.TreeItemCollapsibleState.None),
      new SprintItem("Blocked", "1 story needs attention", vscode.TreeItemCollapsibleState.None),
    ];
  }
}

/**
 * Agent sidebar tree data provider.
 */
class AgentTreeProvider implements vscode.TreeDataProvider<SprintItem> {
  getTreeItem(element: SprintItem): vscode.TreeItem {
    return element;
  }

  getChildren(): SprintItem[] {
    // TODO: Fetch from API via SDK
    return [
      new SprintItem("agent-1", "working — story 1-3", vscode.TreeItemCollapsibleState.None),
      new SprintItem("agent-2", "idle", vscode.TreeItemCollapsibleState.None),
    ];
  }
}

class SprintItem extends vscode.TreeItem {
  constructor(
    public readonly label: string,
    public readonly description: string,
    public readonly collapsibleState: vscode.TreeItemCollapsibleState,
  ) {
    super(label, collapsibleState);
    this.tooltip = `${label}: ${description}`;
  }
}
