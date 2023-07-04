import { Static, Type } from '@sinclair/typebox';

export const BuildFunctionRequestBodySchema = Type.Object({
  // TODO: Enum?
  runtime: Type.String(),
  entryPoint: Type.String(),
  functionId: Type.String(),
  context: Type.Optional(Type.String()),
});

export type BuildFunctionRequestBody = Static<
  typeof BuildFunctionRequestBodySchema
>;
