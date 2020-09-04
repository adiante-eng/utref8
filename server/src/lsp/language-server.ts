import * as lsp from "vscode-languageserver";
import {
  Diagnostics,
  DiagnosticsImpl,
  LanguageFeatures,
  TextSync,
  TextSyncImpl,
  Workspace,
  WorkspaceImpl
} from ".";

export interface LanguageServer<C> {
  readonly diagnostics: Diagnostics;
  start(): void;
  stop(): void;
  readonly textSync: TextSync;
  readonly workspace: Workspace<C>;
}

export function createLanguageServer<C>(features: LanguageFeatures): LanguageServer<C> {
  return new LanguageServerImpl<C>(features);
}

class LanguageServerImpl<C> implements LanguageServer<C> {
  private readonly connection: lsp.Connection;
  private readonly features: LanguageFeatures;
  private started = false;
  private _diagnostics?: DiagnosticsImpl;
  private _textSync?: TextSyncImpl;
  private _workspace?: WorkspaceImpl<C>;

  constructor(features: LanguageFeatures) {
    this.connection = lsp.createConnection(lsp.ProposedFeatures.all);
    this.features = features;

    // General Messages
    this.connection.onInitialize(this.initialize.bind(this));
    this.connection.onInitialized((_params) => {
      if (this._workspace && this._workspace.isConfigurable) {
        this.connection.client.register(lsp.DidChangeConfigurationNotification.type, undefined);
      }
    });

    this.connection.onShutdown(this.shutdown.bind(this));
    this.connection.onExit(this.exit.bind(this));

    // Language Features
    registerLanguageFeatures(features, this.connection);
  }

  private initialize(client: lsp.InitializeParams) {
    const capabilities = computeFeatureCapabilities(this.features);
    capabilities.experimental = false;

    if (this._diagnostics) {
      this._diagnostics.relatedInformation = !!client.capabilities.textDocument?.publishDiagnostics
        ?.relatedInformation;
    }

    if (this._textSync) {
      capabilities.textDocumentSync = {
        openClose: true,
        change: lsp.TextDocumentSyncKind.Incremental,
        willSave: true,
        willSaveWaitUntil: !!this.features.provideWillSaveTextDocumentWaitUntil,
        save: {
          includeText: true
        }
      };
    }

    if (this._workspace && client.capabilities.workspace?.configuration) {
      const loadConfiguration = (uri?: string) => {
        return this.connection.workspace.getConfiguration({
          scopeUri: uri,
          section: this.features.languageId
        }) as Promise<C | undefined>;
      };
      this._workspace.loadConfiguration = loadConfiguration;
      this.connection.onDidChangeConfiguration(
        this._workspace.didChangeConfiguration.bind(this._workspace)
      );
    }

    if ((this._workspace || this._textSync) && client.capabilities.workspace?.workspaceFolders) {
      const handler = !this._textSync
        ? (e: lsp.WorkspaceFoldersChangeEvent) => {
            this._workspace!.didChangeWorkspaceFolder(e);
          }
        : !this._workspace
        ? (e: lsp.WorkspaceFoldersChangeEvent) => {
            this._textSync!.didChangeWorkspaceFolder(e);
          }
        : (e: lsp.WorkspaceFoldersChangeEvent) => {
            this._workspace!.didChangeWorkspaceFolder(e);
            this._textSync!.didChangeWorkspaceFolder(e);
          };
      this.connection.workspace.onDidChangeWorkspaceFolders(handler);
      capabilities.workspace = {
        workspaceFolders: {
          supported: true,
          changeNotifications: this.features.languageId
        }
      };
    }

    return { capabilities };
  }

  private shutdown() {
    console.log("Shutdown...");
  }

  private exit() {
    console.log("Exit...");
  }

  get diagnostics(): Diagnostics {
    if (!this._diagnostics) {
      if (this.started) {
        throw new Error(
          "The diagnostics must be accessed before starting the server, in order to provide auto-configuration"
        );
      }
      this._diagnostics = new DiagnosticsImpl(this.connection.sendDiagnostics.bind(this.connection));
    }
    return this._diagnostics;
  }

  start() {
    this.started = true;
    this.connection.listen();
  }

  stop() {
    this.connection.dispose();
  }

  get textSync(): TextSync {
    if (!this._textSync) {
      if (this.started) {
        throw new Error(
          "The textSync must be accessed before starting the server, in order to provide auto-configuration"
        );
      }
      const textSync = new TextSyncImpl({
        applyEdit: this.connection.workspace.applyEdit.bind(this.connection.workspace),
        getTextDocument: undefined,
        listTextDocuments: undefined
      });
      this.connection.onDidOpenTextDocument(textSync.didOpen.bind(textSync));
      this.connection.onDidChangeTextDocument(textSync.didChange.bind(textSync));
      this.connection.onWillSaveTextDocument(textSync.willSave.bind(textSync));
      this.connection.onDidSaveTextDocument(textSync.didSave.bind(textSync));
      this.connection.onDidCloseTextDocument(textSync.didClose.bind(textSync));
      this._textSync = textSync;
    }
    return this._textSync;
  }

  get workspace(): Workspace<C> {
    if (!this._workspace) {
      if (this.started) {
        throw new Error(
          "The workspace must be accessed before starting the server, in order to provide auto-configuration"
        );
      }
      this._workspace = new WorkspaceImpl<C>(this.features.languageId);
      this.connection.onDidChangeWatchedFiles(
        this._workspace.didChangeWatchedFiles.bind(this._workspace)
      );
    }
    return this._workspace;
  }
}

function computeFeatureCapabilities(features: LanguageFeatures): lsp.ServerCapabilities {
  const capabilities: lsp.ServerCapabilities = {};
  capabilities.codeActionProvider = !!features.provideCodeAction;
  if (features.provideCodeLens) {
    capabilities.codeLensProvider = {
      resolveProvider: !!features.provideCodeLensResolve
    };
  }
  capabilities.colorProvider = !!features.provideColorPresentation;
  if (features.provideCompletion) {
    capabilities.completionProvider = {
      resolveProvider: !!features.provideCompletionResolve
    };
  }
  capabilities.declarationProvider = !!features.provideDeclaration;
  capabilities.definitionProvider = !!features.provideDefinition;
  capabilities.documentFormattingProvider = !!features.provideDocumentFormatting;
  capabilities.documentHighlightProvider = !!features.provideDocumentHighlight;
  if (features.provideDocumentLinks) {
    capabilities.documentLinkProvider = {
      resolveProvider: !!features.provideDocumentLinkResolve
    };
  }
  if (features.provideDocumentOnTypeFormatting) {
    capabilities.documentOnTypeFormattingProvider = {
      firstTriggerCharacter: features.provideDocumentOnTypeFormatting.firstTriggerCharacter,
      moreTriggerCharacter: features.provideDocumentOnTypeFormatting.moreTriggerCharacter
    };
  }
  capabilities.documentRangeFormattingProvider = !!features.provideDocumentRangeFormatting;
  capabilities.documentSymbolProvider = !!features.provideDocumentSymbol;
  if (features.provideExecuteCommand) {
    capabilities.executeCommandProvider = {
      commands: features.provideExecuteCommand.commands
    };
  }
  capabilities.foldingRangeProvider = !!features.provideFoldingRanges;
  capabilities.hoverProvider = !!features.provideHover;
  capabilities.implementationProvider = !!features.provideImplementation;
  capabilities.referencesProvider = !!features.provideReferences;
  capabilities.renameProvider = !!features.provideRenameRequest;
  capabilities.selectionRangeProvider = !!features.provideSelectionRanges;
  if (features.provideSignatureHelp) {
    capabilities.signatureHelpProvider = {
      triggerCharacters: features.provideSignatureHelp.triggerCharacters,
      retriggerCharacters: features.provideSignatureHelp.retriggerCharacters
    };
  }
  capabilities.typeDefinitionProvider = !!features.provideTypeDefinition;
  capabilities.workspaceSymbolProvider = !!features.provideWorkspaceSymbol;

  return capabilities;
}

function registerLanguageFeatures(features: LanguageFeatures, connection: lsp.Connection) {
  !!features.provideCodeAction && connection.onCodeAction(features.provideCodeAction.bind(features));
  !!features.provideCodeLens && connection.onCodeLens(features.provideCodeLens.bind(features));
  !!features.provideCodeLensResolve &&
    connection.onCodeLensResolve(features.provideCodeLensResolve.bind(features));
  !!features.provideColorPresentation &&
    connection.onColorPresentation(features.provideColorPresentation.bind(features));
  !!features.provideCompletion && connection.onCompletion(features.provideCompletion.bind(features));
  !!features.provideCompletionResolve &&
    connection.onCompletionResolve(features.provideCompletionResolve.bind(features));
  !!features.provideDeclaration && connection.onDeclaration(features.provideDeclaration.bind(features));
  !!features.provideDefinition && connection.onDefinition(features.provideDefinition.bind(features));
  !!features.provideDocumentColor &&
    connection.onDocumentColor(features.provideDocumentColor.bind(features));
  !!features.provideDocumentFormatting &&
    connection.onDocumentFormatting(features.provideDocumentFormatting.bind(features));
  !!features.provideDocumentHighlight &&
    connection.onDocumentHighlight(features.provideDocumentHighlight.bind(features));
  !!features.provideDocumentLinkResolve &&
    connection.onDocumentLinkResolve(features.provideDocumentLinkResolve.bind(features));
  !!features.provideDocumentLinks &&
    connection.onDocumentLinks(features.provideDocumentLinks.bind(features));
  !!features.provideDocumentOnTypeFormatting &&
    connection.onDocumentOnTypeFormatting(
      features.provideDocumentOnTypeFormatting.handler.bind(features)
    );
  !!features.provideDocumentRangeFormatting &&
    connection.onDocumentRangeFormatting(features.provideDocumentRangeFormatting.bind(features));
  !!features.provideDocumentSymbol &&
    connection.onDocumentSymbol(features.provideDocumentSymbol.bind(features));
  !!features.provideExecuteCommand &&
    connection.onExecuteCommand(features.provideExecuteCommand.handler.bind(features));
  !!features.provideFoldingRanges &&
    connection.onFoldingRanges(features.provideFoldingRanges.bind(features));
  !!features.provideHover && connection.onHover(features.provideHover.bind(features));
  !!features.provideImplementation &&
    connection.onImplementation(features.provideImplementation.bind(features));
  !!features.providePrepareRename &&
    connection.onPrepareRename(features.providePrepareRename.bind(features));
  !!features.provideReferences && connection.onReferences(features.provideReferences.bind(features));
  !!features.provideRenameRequest &&
    connection.onRenameRequest(features.provideRenameRequest.bind(features));
  !!features.provideSelectionRanges &&
    connection.onSelectionRanges(features.provideSelectionRanges.bind(features));
  !!features.provideSignatureHelp &&
    connection.onSignatureHelp(features.provideSignatureHelp.handler.bind(features));
  !!features.provideTypeDefinition &&
    connection.onTypeDefinition(features.provideTypeDefinition.bind(features));
  !!features.provideWillSaveTextDocumentWaitUntil &&
    connection.onWillSaveTextDocumentWaitUntil(
      features.provideWillSaveTextDocumentWaitUntil.bind(features)
    );
  !!features.provideWorkspaceSymbol &&
    connection.onWorkspaceSymbol(features.provideWorkspaceSymbol.bind(features));
}
