// TODO: Clean up this file and it's types.
import { Client, ClientUnaryCall, requestCallback } from '@grpc/grpc-js';
// import type { MessageTypeDefinition } from '@grpc/proto-loader';

type SubtypeConstructor<
  Constructor extends new (...args: any) => any,
  Subtype,
> = {
  // skipcq: JS-0362
  new (...args: ConstructorParameters<Constructor>): Subtype;
};

// export interface VersionArgs {}
// export interface VersionResponse {
//   version: string;
// }
export interface RequestArgs {
  userPayload: string;
  userId: string;
  token: string;
}
export interface ProcessResponse {
  userResponse: string;
}

export interface MdsClient extends Client {
  // unaryCall(argument: RequestArgs, metadata: grpc.Metadata, options: grpc.CallOptions, callback: grpc.requestCallback<_example_package_ServerMessage__Output>): grpc.ClientUnaryCall;
  // unaryCall(argument: RequestArgs, metadata: grpc.Metadata, callback: grpc.requestCallback<_example_package_ServerMessage__Output>): grpc.ClientUnaryCall;
  // unaryCall(argument: RequestArgs, options: grpc.CallOptions, callback: grpc.requestCallback<_example_package_ServerMessage__Output>): grpc.ClientUnaryCall;
  process(
    argument: RequestArgs,
    callback: requestCallback<ProcessResponse>,
  ): ClientUnaryCall;
  // unaryCall(argument: RequestArgs, metadata: grpc.Metadata, options: grpc.CallOptions, callback: grpc.requestCallback<_example_package_ServerMessage__Output>): grpc.ClientUnaryCall;
  // unaryCall(argument: RequestArgs, metadata: grpc.Metadata, callback: grpc.requestCallback<_example_package_ServerMessage__Output>): grpc.ClientUnaryCall;
  // unaryCall(argument: RequestArgs, options: grpc.CallOptions, callback: grpc.requestCallback<_example_package_ServerMessage__Output>): grpc.ClientUnaryCall;
  process(
    argument: RequestArgs,
    callback: requestCallback<ProcessResponse>,
  ): ClientUnaryCall;
}

export interface MdsProtoDefinition {
  // ClientMessage: MessageTypeDefinition;
  Interchange: SubtypeConstructor<typeof Client, MdsClient> & {
    service: MdsClient;
  };
  // ServerMessage: MessageTypeDefinition;
}

export interface ProtoGrpcType {
  mdsCloud: {
    dockerMinion: MdsProtoDefinition;
  };
}
