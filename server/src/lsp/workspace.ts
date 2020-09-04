import * as lsp from "vscode-languageserver";
import { TypedEmitter } from "tiny-typed-emitter";

export interface Workspace<C> {
  readonly workspaceFolders: Array<lsp.WorkspaceFolder>;
  getConfiguration(uri: string): Thenable<C | undefined>;
  readonly isConfigurable: boolean;
  executeCommand(command: string, args?: any[]): void;
  on<U extends keyof WorkspaceEvents<C>>(event: U, listener: WorkspaceEvents<C>[U]): this;
}

export interface WorkspaceEvents<C> {
  didChangeWorkspaceFolders(added: lsp.WorkspaceFolder[], removed: lsp.WorkspaceFolder[]): void;
  didChangeConfiguration(configuration: C): void;
  didChangeWatchedFiles(changes: Array<lsp.FileEvent>): void;
}

export class WorkspaceImpl<C> extends TypedEmitter<WorkspaceEvents<C>> implements Workspace<C> {
  private readonly languageId: string;

  private readonly configurationCache: Map<string, Thenable<C | undefined>> = new Map();
  loadConfiguration?: (uri?: string) => Promise<C | undefined> = undefined;

  constructor(languageId: string) {
    super();
    this.languageId = languageId;
  }

  workspaceFolders: lsp.WorkspaceFolder[] = [];

  executeCommand(command: string, args?: any[] | undefined): void {
    throw new Error("Method not implemented.");
  }

  getConfiguration(uri?: string): Thenable<C | undefined> {
    if (!this.loadConfiguration) {
      return Promise.resolve(undefined);
    }

    let result = this.configurationCache.get(uri || "");
    if (!result) {
      result = this.loadConfiguration(uri);
      this.configurationCache.set(uri || "", result);
    }
    return result;
  }

  get isConfigurable(): boolean {
    return !!this.loadConfiguration;
  }

  didChangeConfiguration(change: lsp.DidChangeConfigurationParams) {
    const changed = <C>change.settings[this.languageId];
    this.configurationCache.clear();
    this.configurationCache.set("", Promise.resolve(changed));
    this.emit("didChangeConfiguration", changed);
  }

  didChangeWorkspaceFolder({ added, removed }: lsp.WorkspaceFoldersChangeEvent) {
    this.emit("didChangeWorkspaceFolders", added, removed);
  }

  didChangeWatchedFiles({ changes }: lsp.DidChangeWatchedFilesParams) {
    this.emit("didChangeWatchedFiles", changes);
  }
}
