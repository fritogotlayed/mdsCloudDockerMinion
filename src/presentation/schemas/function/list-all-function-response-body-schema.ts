import { Static, Type } from '@sinclair/typebox';

export const ListAllFunctionResponseBodySchema = Type.Array(
  Type.Object({
    id: Type.String(),
    name: Type.String(),
    accountId: Type.String(),
    created: Type.String(),
    maxProcesses: Type.Number(),
    nextVersion: Type.Number(),
  }),
);

export type ListAllFunctionResponseBody = Static<
  typeof ListAllFunctionResponseBodySchema
>;
