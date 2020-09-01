import { TypedEmitter } from "tiny-typed-emitter";
import { nanoid } from "nanoid";

export interface TextFiles {
  getAllLines(uri: string, version?: string): Promise<string[]>;
  getChanges(from: string, to?: string): Promise<Array<TextFileChange>>;
  list(version?: string): Promise<string[]>;
  on<U extends keyof TextFilesEvents>(event: U, listener: TextFilesEvents[U]): this;
}

export interface TextFileChange {
  uri: string;
  start: number;
  before?: string[];
  after?: string[];
}

export interface TextFileInfo {
  uri: string;
  version: string;
}

export interface TextFilesEvents {
  add(uri: string, version: string): void;
  change(changes: Array<TextFileChange>): void;
  remove(uri: string, version: string): void;
}

class TextFilesImpl extends TypedEmitter<TextFilesEvents> implements TextFiles {
  readonly cachedFiles: Array<TextFile> = [];

  async getAllLines(uri: string, version?: string): Promise<string[]> {
    throw new Error("Method not implemented.");
  }
  async getChanges(uri: string, from: string, to?: string): Promise<Array<TextFileChange>> {
    throw new Error("Method not implemented.");
  }

  private getTextFile(uri: string) {
    let cached = this.cachedFiles.find((file) => file.uri == uri);
    if (!cached) {
      const lines = ["foo", "bar", "baz"];
      cached = new TextFile(uri, lines);
      this.cachedFiles.push(cached);
    }
    return cached;
  }

  async list(): Promise<string[]> {
    throw new Error("Method not implemented.");
  }
}

function toTextFileInfo({ uri, versions, isDirty }: TextFile): TextFileInfo {
  return { uri, version: versions[0].id, isOpen: true, isDirty };
}

class TextFile {
  constructor(public readonly uri: string, public readonly lines: string[]) {
    this.versions.push({ id: nanoid() });
  }

  readonly versions: Array<TextFileVersion> = [];
  isDirty = false;
}

interface TextFileVersion {
  id: string;
  changes?: Array<TextFileChange>;
}
