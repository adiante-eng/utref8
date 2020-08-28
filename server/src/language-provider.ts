import * as lsp from "vscode-languageserver";

export interface LanguageProvider {
  readonly languageId: string;

  provideCodeAction?: lsp.ServerRequestHandler<
    lsp.CodeActionParams,
    (lsp.Command | lsp.CodeAction)[] | undefined | null,
    (lsp.Command | lsp.CodeAction)[],
    void
  >;

  provideCodeLens?: lsp.ServerRequestHandler<
    lsp.CodeLensParams,
    lsp.CodeLens[] | undefined | null,
    lsp.CodeLens[],
    void
  >;

  provideCodeLensResolve?: lsp.RequestHandler<lsp.CodeLens, lsp.CodeLens, void>;

  provideColorPresentation?: lsp.ServerRequestHandler<
    lsp.ColorPresentationParams,
    lsp.ColorPresentation[] | undefined | null,
    lsp.ColorPresentation[],
    void
  >;

  provideCompletion?: lsp.ServerRequestHandler<
    lsp.CompletionParams,
    lsp.CompletionItem[] | lsp.CompletionList | undefined | null,
    lsp.CompletionItem[],
    void
  >;

  provideCompletionResolve?: lsp.RequestHandler<lsp.CompletionItem, lsp.CompletionItem, void>;

  provideDeclaration?: lsp.ServerRequestHandler<
    lsp.DeclarationParams,
    lsp.Declaration | lsp.DeclarationLink[] | undefined | null,
    lsp.Location[] | lsp.DeclarationLink[],
    void
  >;

  provideDefinition?: lsp.ServerRequestHandler<
    lsp.DefinitionParams,
    lsp.Definition | lsp.DefinitionLink[] | undefined | null,
    lsp.Location[] | lsp.DefinitionLink[],
    void
  >;

  provideDocumentColor?: lsp.ServerRequestHandler<
    lsp.DocumentColorParams,
    lsp.ColorInformation[] | undefined | null,
    lsp.ColorInformation[],
    void
  >;
  provideDocumentFormatting?: lsp.ServerRequestHandler<
    lsp.DocumentFormattingParams,
    lsp.TextEdit[] | undefined | null,
    never,
    void
  >;

  provideDocumentHighlight?: lsp.ServerRequestHandler<
    lsp.DocumentHighlightParams,
    lsp.DocumentHighlight[] | undefined | null,
    lsp.DocumentHighlight[],
    void
  >;

  provideDocumentLinkResolve?: lsp.RequestHandler<
    lsp.DocumentLink,
    lsp.DocumentLink | undefined | null,
    void
  >;

  provideDocumentLinks?: lsp.ServerRequestHandler<
    lsp.DocumentLinkParams,
    lsp.DocumentLink[] | undefined | null,
    lsp.DocumentLink[],
    void
  >;

  provideDocumentOnTypeFormatting?: DocumentOnTypeFormattingProvider;

  provideDocumentRangeFormatting?: lsp.ServerRequestHandler<
    lsp.DocumentRangeFormattingParams,
    lsp.TextEdit[] | undefined | null,
    never,
    void
  >;

  provideDocumentSymbol?: lsp.ServerRequestHandler<
    lsp.DocumentSymbolParams,
    lsp.SymbolInformation[] | lsp.DocumentSymbol[] | undefined | null,
    lsp.SymbolInformation[] | lsp.DocumentSymbol[],
    void
  >;

  provideExecuteCommand?: ExecuteCommandProvider;

  provideFoldingRanges?: lsp.ServerRequestHandler<
    lsp.FoldingRangeParams,
    lsp.FoldingRange[] | undefined | null,
    lsp.FoldingRange[],
    void
  >;

  provideHover?: lsp.ServerRequestHandler<lsp.HoverParams, lsp.Hover | undefined | null, never, void>;

  provideImplementation?: lsp.ServerRequestHandler<
    lsp.ImplementationParams,
    lsp.Definition | lsp.DefinitionLink[] | undefined | null,
    lsp.Location[] | lsp.DefinitionLink[],
    void
  >;

  providePrepareRename?: lsp.RequestHandler<
    lsp.PrepareRenameParams,
    lsp.Range | { range: lsp.Range; placeholder: string } | undefined | null,
    void
  >;

  provideReferences?: lsp.ServerRequestHandler<
    lsp.ReferenceParams,
    lsp.Location[] | undefined | null,
    lsp.Location[],
    void
  >;

  provideRenameRequest?: lsp.ServerRequestHandler<
    lsp.RenameParams,
    lsp.WorkspaceEdit | undefined | null,
    never,
    void
  >;

  provideSelectionRanges?: lsp.ServerRequestHandler<
    lsp.SelectionRangeParams,
    lsp.SelectionRange[] | undefined | null,
    lsp.SelectionRange[],
    void
  >;

  provideSignatureHelp?: SignatureHelpProvider;

  provideTypeDefinition?: lsp.ServerRequestHandler<
    lsp.TypeDefinitionParams,
    lsp.Definition | lsp.DefinitionLink[] | undefined | null,
    lsp.Location[] | lsp.DefinitionLink[],
    void
  >;

  provideWillSaveTextDocumentWaitUntil?: lsp.RequestHandler<
    lsp.WillSaveTextDocumentParams,
    lsp.TextEdit[] | undefined | null,
    void
  >;

  provideWorkspaceSymbol?: lsp.ServerRequestHandler<
    lsp.WorkspaceSymbolParams,
    lsp.SymbolInformation[] | undefined | null,
    lsp.SymbolInformation[],
    void
  >;
}

export interface DocumentOnTypeFormattingProvider {
  firstTriggerCharacter: string;
  handler: lsp.RequestHandler<
    lsp.DocumentOnTypeFormattingParams,
    lsp.TextEdit[] | undefined | null,
    void
  >;
  moreTriggerCharacter: string[];
}

export interface ExecuteCommandProvider {
  commands: string[];
  handler: lsp.ServerRequestHandler<lsp.ExecuteCommandParams, any | undefined | null, never, void>;
}

export interface SignatureHelpProvider {
  handler: lsp.ServerRequestHandler<
    lsp.SignatureHelpParams,
    lsp.SignatureHelp | undefined | null,
    never,
    void
  >;
  triggerCharacters?: string[];
  retriggerCharacters?: string[];
}
