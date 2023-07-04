import { Static, Type } from '@sinclair/typebox';

export const ExecuteFunctionResponseBodySchema = Type.Unknown();

export type ExecuteFunctionResponseBody = Static<
  typeof ExecuteFunctionResponseBodySchema
>;
