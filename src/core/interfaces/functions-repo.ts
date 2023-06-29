export type CreateFunctionArgs = {
  name: string;
  accountId: string | number;
};

export type FunctionMetadata = {
  id: string;
  accountId: string;
  name: string;
  created: string;
  version?: number;
  nextVersion: number;
  maxProcesses: number;
  lastUpdate?: string;
  containerHost?: string;
  fullTagName?: string;
  tagVersion?: string;
};

export type UpdateFunctionArgs = {
  id: string;
  lastUpdate: string;
  containerHost: string;
  fullTagName: string;
  tagVersion: string;
  incrementVersion: boolean;
};

export interface FunctionsRepo {
  createFunction: (args: CreateFunctionArgs) => Promise<string | null>;
  listFunctions: () => Promise<FunctionMetadata[]>;
  getFunctionInfo: (id: string) => Promise<FunctionMetadata>;
  updateFunctionInfo: (args: UpdateFunctionArgs) => Promise<void>;
  removeFunction: (id: string) => Promise<void>;
}
