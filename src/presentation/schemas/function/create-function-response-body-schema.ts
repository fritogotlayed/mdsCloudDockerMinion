import { Static, Type } from '@sinclair/typebox';

export const CreateFunctionResponseBodySchema = Type.Object({
  name: Type.String(),
  id: Type.String(),
});

export type CreateFunctionResponseBody = Static<
  typeof CreateFunctionResponseBodySchema
>;
