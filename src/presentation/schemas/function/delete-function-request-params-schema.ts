import { Static, Type } from '@sinclair/typebox';

export const DeleteFunctionRequestParamsSchema = Type.Object({
  functionId: Type.String(),
});

export type DeleteFunctionRequestParams = Static<
  typeof DeleteFunctionRequestParamsSchema
>;
