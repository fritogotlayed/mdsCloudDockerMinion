export type RuntimeTools = {
  findEntrypoint: (dir: string) => Promise<string>;
  prepSourceForContainerBuild: (
    localPath: string,
    entryPoint: string,
    userContext?: string,
  ) => Promise<void>;
};
