import * as lsp from "vscode-languageserver";
import { TextDocument } from "vscode-languageserver-textdocument";
import { LanguageProvider } from "./language-provider";
import { TextDocuments } from "./text-documents";

export interface LanguageServer<S> {
  getTextDocument(uri: string): TextDocument | undefined;
  getSettings(uri: string): Thenable<S>;
  readonly hasConfigurationCapability: boolean;
  readonly hasDiagnosticRelatedInformationCapability: boolean;
  readonly hasWorkspaceFolderCapability: boolean;
  onDocumentChange(handler: (uri: string) => void): void;
  sendDiagnostics(params: lsp.PublishDiagnosticsParams): void;
  start(): void;
}

export function createLanguageServer<S>(
  provider: LanguageProvider,
  globalSettings?: S
): LanguageServer<S> {
  return new LanguageServerImpl(provider, globalSettings);
}

const GLOBAL_URI = "__GLOBAL__";

class LanguageServerImpl<S> implements LanguageServer<S> {
  private readonly provider: LanguageProvider;
  private readonly connection: lsp.Connection;
  private readonly capabilities: lsp.ClientCapabilities = {};
  private readonly documents: TextDocuments<TextDocument> = new TextDocuments(TextDocument);
  private readonly settings: Map<string, Thenable<S>> = new Map();
  private readonly documentChangeHandlers: Array<(uri: string) => void> = [];

  constructor(provider: LanguageProvider, globalSettings?: S) {
    this.provider = provider;
    if (globalSettings) {
      this.settings.set(GLOBAL_URI, Promise.resolve(globalSettings));
    }
    this.connection = lsp.createConnection(lsp.ProposedFeatures.all);
    this.connection.onInitialize(this.computeCapabilities.bind(this));
    this.connection.onInitialized(this.registerForConfigurationChanges.bind(this));
    this.registerProvider();
    this.setupConfiguration();
  }

  private registerProvider() {
    !!this.provider.provideCodeAction &&
      this.connection.onCodeAction(this.provider.provideCodeAction.bind(this.provider));
    !!this.provider.provideCodeLens &&
      this.connection.onCodeLens(this.provider.provideCodeLens.bind(this.provider));
    !!this.provider.provideCodeLensResolve &&
      this.connection.onCodeLensResolve(this.provider.provideCodeLensResolve.bind(this.provider));
    !!this.provider.provideColorPresentation &&
      this.connection.onColorPresentation(this.provider.provideColorPresentation.bind(this.provider));
    !!this.provider.provideCompletion &&
      this.connection.onCompletion(this.provider.provideCompletion.bind(this.provider));
    !!this.provider.provideCompletionResolve &&
      this.connection.onCompletionResolve(this.provider.provideCompletionResolve.bind(this.provider));
    !!this.provider.provideDeclaration &&
      this.connection.onDeclaration(this.provider.provideDeclaration.bind(this.provider));
    !!this.provider.provideDefinition &&
      this.connection.onDefinition(this.provider.provideDefinition.bind(this.provider));
    !!this.provider.provideDocumentColor &&
      this.connection.onDocumentColor(this.provider.provideDocumentColor.bind(this.provider));
    !!this.provider.provideDocumentFormatting &&
      this.connection.onDocumentFormatting(this.provider.provideDocumentFormatting.bind(this.provider));
    !!this.provider.provideDocumentHighlight &&
      this.connection.onDocumentHighlight(this.provider.provideDocumentHighlight.bind(this.provider));
    !!this.provider.provideDocumentLinkResolve &&
      this.connection.onDocumentLinkResolve(
        this.provider.provideDocumentLinkResolve.bind(this.provider)
      );
    !!this.provider.provideDocumentLinks &&
      this.connection.onDocumentLinks(this.provider.provideDocumentLinks.bind(this.provider));
    !!this.provider.provideDocumentOnTypeFormatting &&
      this.connection.onDocumentOnTypeFormatting(
        this.provider.provideDocumentOnTypeFormatting.handler.bind(this.provider)
      );
    !!this.provider.provideDocumentRangeFormatting &&
      this.connection.onDocumentRangeFormatting(
        this.provider.provideDocumentRangeFormatting.bind(this.provider)
      );
    !!this.provider.provideDocumentSymbol &&
      this.connection.onDocumentSymbol(this.provider.provideDocumentSymbol.bind(this.provider));
    !!this.provider.provideExecuteCommand &&
      this.connection.onExecuteCommand(this.provider.provideExecuteCommand.handler.bind(this.provider));
    !!this.provider.provideFoldingRanges &&
      this.connection.onFoldingRanges(this.provider.provideFoldingRanges.bind(this.provider));
    !!this.provider.provideHover &&
      this.connection.onHover(this.provider.provideHover.bind(this.provider));
    !!this.provider.provideImplementation &&
      this.connection.onImplementation(this.provider.provideImplementation.bind(this.provider));
    !!this.provider.providePrepareRename &&
      this.connection.onPrepareRename(this.provider.providePrepareRename.bind(this.provider));
    !!this.provider.provideReferences &&
      this.connection.onReferences(this.provider.provideReferences.bind(this.provider));
    !!this.provider.provideRenameRequest &&
      this.connection.onRenameRequest(this.provider.provideRenameRequest.bind(this.provider));
    !!this.provider.provideSelectionRanges &&
      this.connection.onSelectionRanges(this.provider.provideSelectionRanges.bind(this.provider));
    !!this.provider.provideSignatureHelp &&
      this.connection.onSignatureHelp(this.provider.provideSignatureHelp.handler.bind(this.provider));
    !!this.provider.provideTypeDefinition &&
      this.connection.onTypeDefinition(this.provider.provideTypeDefinition.bind(this.provider));
    !!this.provider.provideWillSaveTextDocumentWaitUntil &&
      this.connection.onWillSaveTextDocumentWaitUntil(
        this.provider.provideWillSaveTextDocumentWaitUntil.bind(this.provider)
      );
    !!this.provider.provideWorkspaceSymbol &&
      this.connection.onWorkspaceSymbol(this.provider.provideWorkspaceSymbol.bind(this.provider));
  }

  private computeCapabilities(params: lsp.InitializeParams) {
    Object.assign(this.capabilities, params.capabilities);

    const capabilities: lsp.ServerCapabilities = {};
    capabilities.codeActionProvider = !!this.provider.provideCodeAction;
    if (this.provider.provideCodeLens) {
      capabilities.codeLensProvider = {
        resolveProvider: !!this.provider.provideCodeLensResolve
      };
    }
    capabilities.colorProvider = !!this.provider.provideColorPresentation;
    if (this.provider.provideCompletion) {
      capabilities.completionProvider = {
        resolveProvider: !!this.provider.provideCompletionResolve
      };
    }
    capabilities.declarationProvider = !!this.provider.provideDeclaration;
    capabilities.definitionProvider = !!this.provider.provideDefinition;
    capabilities.documentFormattingProvider = !!this.provider.provideDocumentFormatting;
    capabilities.documentHighlightProvider = !!this.provider.provideDocumentHighlight;
    if (this.provider.provideDocumentLinks) {
      capabilities.documentLinkProvider = {
        resolveProvider: !!this.provider.provideDocumentLinkResolve
      };
    }
    if (this.provider.provideDocumentOnTypeFormatting) {
      capabilities.documentOnTypeFormattingProvider = {
        firstTriggerCharacter: this.provider.provideDocumentOnTypeFormatting.firstTriggerCharacter,
        moreTriggerCharacter: this.provider.provideDocumentOnTypeFormatting.moreTriggerCharacter
      };
    }
    capabilities.documentRangeFormattingProvider = !!this.provider.provideDocumentRangeFormatting;
    capabilities.documentSymbolProvider = !!this.provider.provideDocumentSymbol;
    if (this.provider.provideExecuteCommand) {
      capabilities.executeCommandProvider = {
        commands: this.provider.provideExecuteCommand.commands
      };
    }
    capabilities.experimental = false;
    capabilities.foldingRangeProvider = !!this.provider.provideFoldingRanges;
    capabilities.hoverProvider = !!this.provider.provideHover;
    capabilities.implementationProvider = !!this.provider.provideImplementation;
    capabilities.referencesProvider = !!this.provider.provideReferences;
    capabilities.renameProvider = !!this.provider.provideRenameRequest;
    capabilities.selectionRangeProvider = !!this.provider.provideSelectionRanges;
    if (this.provider.provideSignatureHelp) {
      capabilities.signatureHelpProvider = {
        triggerCharacters: this.provider.provideSignatureHelp.triggerCharacters,
        retriggerCharacters: this.provider.provideSignatureHelp.retriggerCharacters
      };
    }
    capabilities.textDocumentSync = lsp.TextDocumentSyncKind.Incremental;
    capabilities.typeDefinitionProvider = !!this.provider.provideTypeDefinition;
    capabilities.workspace = this.hasWorkspaceFolderCapability
      ? {
          workspaceFolders: {
            supported: true,
            changeNotifications: this.provider.languageId
          }
        }
      : undefined;
    capabilities.workspaceSymbolProvider = !!this.provider.provideWorkspaceSymbol;

    return { capabilities };
  }

  private registerForConfigurationChanges() {
    if (this.hasConfigurationCapability) {
      this.connection.client.register(lsp.DidChangeConfigurationNotification.type, undefined);
    }
  }

  private setupConfiguration() {
    this.connection.onDidChangeConfiguration((change) => {
      let globalSettings = this.settings.get(GLOBAL_URI);
      if (this.hasConfigurationCapability) {
        // Reset all cached document settings
        this.settings.clear();
      } else {
        const changed = <S>change.settings[this.provider.languageId];
        if (changed) {
          globalSettings = Promise.resolve(changed);
        }
      }
      if (globalSettings) {
        this.settings.set(GLOBAL_URI, globalSettings);
      }
    });
  }

  get hasConfigurationCapability() {
    return !!this.capabilities.workspace?.configuration;
  }

  get hasDiagnosticRelatedInformationCapability(): boolean {
    return !!this.capabilities.textDocument?.publishDiagnostics?.relatedInformation;
  }

  get hasWorkspaceFolderCapability(): boolean {
    return !!this.capabilities.workspace?.workspaceFolders;
  }

  onDocumentChange(handler: (uri: string) => void) {
    this.documents.onDidChangeContent((event) => {
      handler(event.document.uri);
    });
  }

  getSettings(uri: string) {
    if (!this.hasConfigurationCapability) {
      return this.settings.get(GLOBAL_URI)!;
    }
    let result = this.settings.get(uri);
    if (!result) {
      result = this.connection.workspace.getConfiguration({
        scopeUri: uri,
        section: this.provider.languageId
      });
      this.settings.set(uri, result);
    }
    return result;
  }

  getTextDocument(uri: string) {
    return this.documents.get(uri);
  }

  sendDiagnostics(params: lsp.PublishDiagnosticsParams) {
    this.connection.sendDiagnostics(params);
  }

  start() {
    this.connection.listen();
  }
}
