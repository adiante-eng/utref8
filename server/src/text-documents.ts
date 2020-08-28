import {
  CancellationToken,
  Connection,
  DidChangeTextDocumentParams,
  DidCloseTextDocumentParams,
  DidOpenTextDocumentParams,
  DidSaveTextDocumentParams,
  Emitter,
  Event,
  Range,
  RequestHandler,
  TextDocumentContentChangeEvent,
  TextDocumentSyncKind,
  TextDocumentWillSaveEvent,
  TextEdit,
  WillSaveTextDocumentParams
} from "vscode-languageserver";

interface ConnectionState {
  __textDocumentSync: TextDocumentSyncKind | undefined;
}

interface TextDocumentContentChangeEventWithRange {
  /**
   * The range of the document that changed.
   */
  range: Range;
  /**
   * The new text for the provided range.
   */
  text: string;
}

export interface TextDocumentsConfiguration<T> {
  create(uri: string, languageId: string, version: number, content: string): T;
  update(document: T, changes: TextDocumentContentChangeEvent[], version: number): T;
}

/**
 * Event to signal changes to a text document.
 */
export interface TextDocumentChangeEvent<T> {
  /**
   * The document that has changed.
   */
  document: T;

  /**
   * The ranges that have changed
   * (in order of application with respect to the
   * respective previous state of the document).
   */
  ranges?: Range[];
}

/**
 * A manager of text documents that supports incremental changes and
 * provides notifications with information about updated ranges.
 */
export class TextDocuments<T> {
  private _configuration: TextDocumentsConfiguration<T>;

  private _documents: { [uri: string]: T };

  private _onDidChangeContent: Emitter<TextDocumentChangeEvent<T>>;
  private _onDidOpen: Emitter<TextDocumentChangeEvent<T>>;
  private _onDidClose: Emitter<TextDocumentChangeEvent<T>>;
  private _onDidSave: Emitter<TextDocumentChangeEvent<T>>;
  private _onWillSave: Emitter<TextDocumentWillSaveEvent<T>>;
  private _willSaveWaitUntil: RequestHandler<TextDocumentWillSaveEvent<T>, TextEdit[], void> | undefined;

  /**
   * Create a new text document manager.
   */
  public constructor(configuration: TextDocumentsConfiguration<T>) {
    this._documents = Object.create(null);
    this._configuration = configuration;

    this._onDidChangeContent = new Emitter<TextDocumentChangeEvent<T>>();
    this._onDidOpen = new Emitter<TextDocumentChangeEvent<T>>();
    this._onDidClose = new Emitter<TextDocumentChangeEvent<T>>();
    this._onDidSave = new Emitter<TextDocumentChangeEvent<T>>();
    this._onWillSave = new Emitter<TextDocumentWillSaveEvent<T>>();
  }

  /**
   * An event that fires when a text document managed by this manager
   * has been opened or the content changes.
   */
  public get onDidChangeContent(): Event<TextDocumentChangeEvent<T>> {
    return this._onDidChangeContent.event;
  }

  /**
   * An event that fires when a text document managed by this manager
   * has been opened.
   */
  public get onDidOpen(): Event<TextDocumentChangeEvent<T>> {
    return this._onDidOpen.event;
  }

  /**
   * An event that fires when a text document managed by this manager
   * will be saved.
   */
  public get onWillSave(): Event<TextDocumentWillSaveEvent<T>> {
    return this._onWillSave.event;
  }

  /**
   * Sets a handler that will be called if a participant wants to provide
   * edits during a text document save.
   */
  public onWillSaveWaitUntil(handler: RequestHandler<TextDocumentWillSaveEvent<T>, TextEdit[], void>) {
    this._willSaveWaitUntil = handler;
  }

  /**
   * An event that fires when a text document managed by this manager
   * has been saved.
   */
  public get onDidSave(): Event<TextDocumentChangeEvent<T>> {
    return this._onDidSave.event;
  }

  /**
   * An event that fires when a text document managed by this manager
   * has been closed.
   */
  public get onDidClose(): Event<TextDocumentChangeEvent<T>> {
    return this._onDidClose.event;
  }

  /**
   * Returns the document for the given URI. Returns undefined if
   * the document is not mananged by this instance.
   *
   * @param uri The text document's URI to retrieve.
   * @return the text document or `undefined`.
   */
  public get(uri: string): T | undefined {
    return this._documents[uri];
  }

  /**
   * Returns all text documents managed by this instance.
   *
   * @return all text documents.
   */
  public all(): T[] {
    return Object.keys(this._documents).map((key) => this._documents[key]);
  }

  /**
   * Returns the URIs of all text documents managed by this instance.
   *
   * @return the URI's of all text documents.
   */
  public keys(): string[] {
    return Object.keys(this._documents);
  }

  /**
   * Listens for `low level` notification on the given connection to
   * update the text documents managed by this instance.
   *
   * Please note that the connection only provides handlers not an event model. Therefore
   * listening on a connection will overwrite the following handlers on a connection:
   * `onDidOpenTextDocument`, `onDidChangeTextDocument`, `onDidCloseTextDocument`,
   * `onWillSaveTextDocument`, `onWillSaveTextDocumentWaitUntil` and `onDidSaveTextDocument`.
   *
   * Use the corresponding events on the TextDocuments instance instead.
   *
   * @param connection The connection to listen on.
   */
  public listen(connection: Connection): void {
    (<ConnectionState>(<any>connection)).__textDocumentSync = TextDocumentSyncKind.Incremental;

    connection.onDidOpenTextDocument((params: DidOpenTextDocumentParams) => {
      const td = params.textDocument;
      const document = this._configuration.create(td.uri, td.languageId, td.version, td.text);

      this._documents[td.uri] = document;
      const toFire = Object.freeze({ document });
      this._onDidOpen.fire(toFire);
      this._onDidChangeContent.fire(toFire);
    });

    connection.onDidChangeTextDocument((params: DidChangeTextDocumentParams) => {
      const td = params.textDocument;
      const changes = params.contentChanges;
      if (changes.length === 0) {
        return;
      }

      let document = this._documents[td.uri];

      const { version } = td;
      if (version === null || version === undefined) {
        throw new Error(`Received document change event for ${td.uri} without valid version identifier`);
      }

      document = this._configuration.update(document, changes, version);
      const ranges =
        changes.findIndex((change) => !("range" in change)) >= 0
          ? undefined
          : changes.map((change) => (<TextDocumentContentChangeEventWithRange>change).range);

      this._documents[td.uri] = document;
      this._onDidChangeContent.fire(Object.freeze({ document, ranges }));
    });

    connection.onDidCloseTextDocument((params: DidCloseTextDocumentParams) => {
      const document = this._documents[params.textDocument.uri];
      if (document) {
        delete this._documents[params.textDocument.uri];
        this._onDidClose.fire(Object.freeze({ document }));
      }
    });

    connection.onWillSaveTextDocument((params: WillSaveTextDocumentParams) => {
      const document = this._documents[params.textDocument.uri];
      if (document) {
        this._onWillSave.fire(Object.freeze({ document, reason: params.reason }));
      }
    });

    connection.onWillSaveTextDocumentWaitUntil(
      (params: WillSaveTextDocumentParams, token: CancellationToken) => {
        const document = this._documents[params.textDocument.uri];
        if (document && this._willSaveWaitUntil) {
          return this._willSaveWaitUntil(Object.freeze({ document, reason: params.reason }), token);
        } else {
          return [];
        }
      }
    );

    connection.onDidSaveTextDocument((event: DidSaveTextDocumentParams) => {
      const document = this._documents[event.textDocument.uri];
      if (document) {
        this._onDidSave.fire(Object.freeze({ document }));
      }
    });
  }
}
