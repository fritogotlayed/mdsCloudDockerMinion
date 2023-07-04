export interface SourceRepo {
  extractSource: (localZipPath: string) => Promise<string>;
  cleanupSource: (localSourcePath: string) => Promise<void>;
}
