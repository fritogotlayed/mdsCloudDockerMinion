const PROTO_PATH = `${__dirname}/protos/containerIO.proto`;

const grpc = require('@grpc/grpc-js');
const protoLoader = require('@grpc/proto-loader');
const globals = require('../globals');

const self = {
  loadDefinition: () => protoLoader.load(
    PROTO_PATH,
    {
      keepCase: true,
      longs: String,
      enums: String,
      defaults: true,
      oneofs: true,
    },
  ).then((definition) => grpc.loadPackageDefinition(definition).mdsCloud.dockerMinion),

  convertPayloadToString: (payload) => {
    const t = typeof payload;

    switch (t.toUpperCase()) {
      case 'OBJECT':
        return JSON.stringify(payload);
      default:
        return payload.toString();
    }
  },

  convertUserResponseToObject: (data) => {
    if (data) {
      return JSON.parse(data);
    }
    return null;
  },

  /**
   * Creates a gRPC client from a given gRPC definition
   * @param {Object} definition the gRPC definition
   * @param {String} hostIp the endpoint the remote procedure is listening at
   */
  createClientFromGrpcDefinition: (definition, hostIp) => new definition.Interchange(
    `${hostIp}:50051`,
    grpc.credentials.createInsecure(),
  ),

  /**
   * TODO: Does this go here?
   * @param {Object} args
   * @param {Object} args.definition the gRPC definition
   * @param {String} args.hostIp the endpoint the remote procedure is listening at
   * @param {String} args.payload payload to send to the remote procedure
   * @param {String} args.tries Internal retry counter
   * @param {String} args.userId user id to pre-seed mdsSdk for user execution
   * @param {String} args.userToken user token to pre-seed mdsSdk for user execution
   */
  invoke: async ({
    definition,
    hostIp,
    payload,
    tries,
    userId,
    userToken,
  }) => {
    const def = definition || await self.loadDefinition();
    const client = self.createClientFromGrpcDefinition(def, hostIp);
    const logger = globals.getLogger();
    logger.debug({
      definition,
      hostIp,
      payload,
      tries,
      userId,
      userToken,
    }, 'Attempting to invoke function');

    return new Promise((resolve, reject) => {
      const userPayload = self.convertPayloadToString(payload);
      client.process({
        userPayload,
        userId,
        token: userToken,
      }, (err, resp) => {
        if (err) {
          return reject(err);
        }
        const mappedResponse = self.convertUserResponseToObject(resp.userResponse);
        return resolve(mappedResponse);
      });
    }).catch((err) => {
      const currTries = tries || 1;
      const endpointUnavailable = err.message.indexOf('14 UNAVAILABLE') > -1;
      const withinRetries = currTries < 20;
      if (endpointUnavailable && withinRetries) {
        // const logger = globals.getLogger();
        // logger.trace(
        //  { currTries, hostIp },
        //  'Retrying call since endpoint unavailable and low try count',
        // );

        return globals.delay(250)
          .then(() => self.invoke({
            definition: def,
            hostIp,
            payload,
            tries: currTries + 1,
            userToken,
          }));
      }

      if (endpointUnavailable && !withinRetries) {
        throw new Error('Could not connect to provided IP');
      }

      throw err;
    });
  },
};

module.exports = self;
