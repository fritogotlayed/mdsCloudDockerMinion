import { join } from 'path';
import { load } from '@grpc/proto-loader';
import { credentials, loadPackageDefinition } from '@grpc/grpc-js';
import { MdsProtoDefinition, ProtoGrpcType } from './types/package';
import { getLogger } from '../../presentation/logging';
import { delay } from '../../utils';

const PROTO_PATH = join(__dirname, 'protos', 'containerIO.proto');

export class GrpcClient {
  async loadDefinition() {
    const definition = await load(PROTO_PATH, {
      keepCase: true,
      longs: String,
      enums: String,
      defaults: true,
      oneofs: true,
    });
    return (loadPackageDefinition(definition) as unknown as ProtoGrpcType)
      .mdsCloud.dockerMinion;
  }

  convertPayloadToString(payload: unknown): string {
    const payloadType = typeof payload;
    switch (payloadType.toUpperCase()) {
      case 'OBJECT':
        return JSON.stringify(payload);
      default:
        return String(payload);
    }
  }

  convertUserResponseToObject(data?: string | null) {
    if (data) {
      return JSON.parse(data);
    }
    return null;
  }

  createClientFromGrpcDefinition(
    definition: MdsProtoDefinition,
    hostIp: string,
  ) {
    return new definition.Interchange(
      `${hostIp}:50051`,
      credentials.createInsecure(),
    );
  }

  async invoke({
    definition,
    hostIp,
    payload,
    tries,
    userId,
    userToken,
  }: {
    definition?: MdsProtoDefinition;
    hostIp: string;
    payload: string;
    tries?: number;
    userId: string;
    userToken: string;
  }): Promise<unknown> {
    const def = definition || (await this.loadDefinition());
    const client = this.createClientFromGrpcDefinition(def, hostIp);
    const logger = getLogger();
    logger.debug(
      {
        hostIp,
        payload,
        tries,
        userId,
        userToken,
      },
      'Attempting to invoke function',
    );
    logger.trace({ definition }, 'Function definition');

    return new Promise((resolve, reject) => {
      const userPayload = this.convertPayloadToString(payload);
      client.process(
        {
          userPayload,
          userId,
          token: userToken,
        },
        (err: any, resp: any) => {
          if (err) {
            return reject(err);
          }
          const mappedResponse = this.convertUserResponseToObject(
            resp.userResponse,
          );
          return resolve(mappedResponse);
        },
      );
    }).catch(async (err) => {
      const currTries = tries ?? 1;
      const endpointUnavailable = err.message.indexOf('14 UNAVAILABLE') > -1;
      const withinRetries = currTries < 20;
      if (endpointUnavailable && withinRetries) {
        await delay(250);
        return this.invoke({
          definition: def,
          hostIp,
          payload,
          tries: currTries + 1,
          userToken,
          userId,
        });
      }

      if (endpointUnavailable && !withinRetries) {
        throw new Error('Could not connect to provided IP');
      }

      throw err;
    });
  }
}
