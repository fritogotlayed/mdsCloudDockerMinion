import { readFileSync } from 'fs';

/**
 * @returns key / value set of files to write
 */
export function generateProtobufFiles(): Record<string, string | Buffer> {
  // TODO: make async
  const data = readFileSync(
    `${__dirname}/../../../../infrastructure/grpc/protos/containerIO.proto`,
  );

  return {
    'containerIO.proto': data,
  };
}
