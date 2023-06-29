import { Static, Type } from '@sinclair/typebox';

export const ExecuteFunctionRequestParamsSchema = Type.Object({
  functionId: Type.String(),
});

export type ExecuteFunctionRequestParams = Static<
  typeof ExecuteFunctionRequestParamsSchema
>;
