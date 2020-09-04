import { TypedEmitter } from "tiny-typed-emitter";
import * as lsp from "vscode-languageserver";
import * as fs from "fs";

export interface TextSyncBase {
  applyEdit: ApplyEditFn;
  getTextDocument: GetTextDocumentFn;
  listTextDocuments: ListTextDocumentsFn;
}

export interface ApplyEditFn {
  (paramOrEdit: lsp.ApplyWorkspaceEditParams | lsp.WorkspaceEdit): Promise<
    lsp.ApplyWorkspaceEditResponse
  >;
}

export interface GetTextDocumentFn {
  (uri: lsp.DocumentUri): Promise<lsp.TextDocument>;
}

export interface ListTextDocumentsFn {
  (path: lsp.DocumentUri): Promise<Array<lsp.DocumentUri>>;
}

export interface TextSync extends TextSyncBase {
  on<U extends keyof TextSyncEvents>(event: U, listener: TextSyncEvents[U]): this;
}

export interface TextSyncEvents {
  // TODO: Emit this on workspace changes
  didAdd(params: DidAddTextDocumentParams): void;
  didOpen(params: lsp.DidOpenTextDocumentParams): void;
  didChange(params: lsp.DidChangeTextDocumentParams): void;
  willSave(params: lsp.WillSaveTextDocumentParams): void;
  didSave(params: lsp.DidSaveTextDocumentParams): void;
  didClose(params: lsp.DidCloseTextDocumentParams): void;
  // TODO: Emit this on workspace changes
  didRemove(params: DidRemoveTextDocumentParams): void;
}

/**
 * The parameters send in an add text document notification
 */
export interface DidAddTextDocumentParams {
  /**
   * The document that was added.
   */
  textDocument: lsp.TextDocumentIdentifier;
}

/**
 * The parameters send in a remove text document notification
 */
export interface DidRemoveTextDocumentParams {
  /**
   * The document that was removed.
   */
  textDocument: lsp.TextDocumentIdentifier;
}

export class TextSyncImpl extends TypedEmitter<TextSyncEvents> implements TextSync {
  constructor() {
    super();
  }

  doApplyEdit: ApplyEditFn = (uri) => {};

  readonly applyEdit: ApplyEditFn = (uri) => {
    throw new Error("Method not implemented.");
  };

  doGetTextDocument: GetTextDocumentFn = async (uri) => {
    const filePath = this.resolveUriToPath(uri);
    const content = await fs.readFile(filePath, "utf8", (err, data) => {
      if (err) {
        console.error(err);
        return;
      }
    });
    return lsp.TextDocument.create(uri, "plaintext", -1, content);
  };

  readonly getTextDocument: GetTextDocumentFn = (uri) => {
    throw new Error("Method not implemented.");
  };

  doListTextDocuments: ListTextDocumentsFn = (path) => {};

  readonly listTextDocuments: ListTextDocumentsFn = () => {
    throw new Error("Method not implemented.");
  };

  didOpen(params: lsp.DidOpenTextDocumentParams): void {
    this.emit("didOpen", params);
  }

  didChange(params: lsp.DidChangeTextDocumentParams): void {
    this.emit("didChange", params);
  }

  willSave(params: lsp.WillSaveTextDocumentParams): void {
    this.emit("willSave", params);
  }

  didSave(params: lsp.DidSaveTextDocumentParams): void {
    this.emit("didSave", params);
  }

  didClose(params: lsp.DidCloseTextDocumentParams): void {
    this.emit("didClose", params);
  }

  didChangeWorkspaceFolder({ added, removed }: lsp.WorkspaceFoldersChangeEvent) {
    // TODO: Compute resulting changes on TextDocument level
    // this.emit("didChangeWorkspaceFolders", added, removed);
  }

  didChangeWatchedFiles({ changes }: lsp.DidChangeWatchedFilesParams) {
    // TODO: Compute resulting changes on TextDocument level
    // this.emit("didChangeWatchedFiles", changes);
  }
}
