import * as lsp from "vscode-languageserver";
import { createLanguageServer, Diagnostics, LanguageFeatures, TextSync } from "./lsp";

interface SampleLanguageConfiguration {
  maxNumberOfProblems: number;
}

const defaultSettings: SampleLanguageConfiguration = { maxNumberOfProblems: 3 };

export class SampleLanguage implements LanguageFeatures {
  readonly languageId = "languageServerExample";

  private readonly diagnostics: Diagnostics;
  private readonly textSync: TextSync;

  constructor() {
    const server = createLanguageServer(this);
    this.diagnostics = server.diagnostics;
    this.textSync = server.textSync;

    server.textSync.on("didOpen", ({ textDocument: { uri } }) => this.validateTextDocument(uri));
    server.textSync.on("didChange", ({ textDocument: { uri } }) => this.validateTextDocument(uri));

    server.start();
  }

  provideCompletion(_params: lsp.CompletionParams) {
    return [
      {
        label: "TypeScript",
        kind: lsp.CompletionItemKind.Text,
        data: 1
      },
      {
        label: "JavaScript",
        kind: lsp.CompletionItemKind.Text,
        data: 2
      }
    ];
  }

  provideCompletionResolve(item: lsp.CompletionItem) {
    if (item.data === 1) {
      item.detail = "TypeScript details";
      item.documentation = "TypeScript documentation";
    } else if (item.data === 2) {
      item.detail = "JavaScript details";
      item.documentation = "JavaScript documentation";
    }
    return item;
  }

  private async validateTextDocument(uri: string) {
    // In this simple example we get the settings for every validate run.
    const settings = defaultSettings;
    const textDocument = await this.textSync.getTextDocument(uri);
    if (!textDocument) {
      return;
    }
    const text = textDocument.getText();

    let problems = 0;
    const diagnostics: lsp.Diagnostic[] = [];
    // The validator creates diagnostics for all uppercase words length 2 and more
    const pattern = /\b[A-Z]{2,}\b/g;
    let m: RegExpExecArray | null;
    while ((m = pattern.exec(text)) && problems < settings.maxNumberOfProblems) {
      problems++;
      const diagnostic: lsp.Diagnostic = {
        severity: lsp.DiagnosticSeverity.Warning,
        range: {
          start: textDocument.positionAt(m.index),
          end: textDocument.positionAt(m.index + m[0].length)
        },
        message: `${m[0]} is all uppercase.`,
        source: "ex"
      };
      if (this.diagnostics.relatedInformation) {
        diagnostic.relatedInformation = [
          {
            location: {
              uri,
              range: { ...diagnostic.range }
            },
            message: "Spelling matters"
          },
          {
            location: {
              uri,
              range: { ...diagnostic.range }
            },
            message: "Particularly for names"
          }
        ];
      }
      diagnostics.push(diagnostic);
    }
    this.diagnostics.publishDiagnostics({ uri, diagnostics });
  }
}

new SampleLanguage();
