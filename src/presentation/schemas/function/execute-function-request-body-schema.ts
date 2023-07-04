import { Static, Type } from '@sinclair/typebox';

export const ExecuteFunctionRequestBodySchema = Type.Unknown();

export type ExecuteFunctionRequestBody = Static<
  typeof ExecuteFunctionRequestBodySchema
>;
