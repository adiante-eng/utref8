import * as lsp from "vscode-languageserver";

/**
 * Diagnostics notification are sent from the server to the client to signal
 * results of validation runs.
 *
 * Diagnostics are "owned" by the server so it is the server’s responsibility
 * to clear them if necessary. The following rule is used for VS Code servers
 * that generate diagnostics:
 *
 * - if a language is single file only (for example HTML) then diagnostics are
 *   cleared by the server when the file is closed.
 * - if a language has a project system (for example C#) diagnostics are not
 *   cleared when a file closes. When a project is opened all diagnostics for
 *   all files are recomputed (or read from a cache).
 *
 * When a file changes it is the server’s responsibility to re-compute
 * diagnostics and push them to the client. If the computed set is empty it has
 * to push the empty array to clear former diagnostics. Newly pushed
 * diagnostics always replace previously pushed diagnostics. There is no
 * merging that happens on the client side.
 */
export interface Diagnostics {
  /**
   * Whether the clients accepts diagnostics with related information.
   */
  readonly relatedInformation: boolean;

  /**
   * Publish diagnostics to the client.
   *
   * @param params the diagnostics to publish
   */
  publishDiagnostics(params: lsp.PublishDiagnosticsParams): void;
}
