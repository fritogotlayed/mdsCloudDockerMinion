import { Static, Type } from '@sinclair/typebox';

export const BuildFunctionResponseBodySchema = Type.Object({
  status: Type.String(),
});

export type BuildFunctionResponseBody = Static<
  typeof BuildFunctionResponseBodySchema
>;
