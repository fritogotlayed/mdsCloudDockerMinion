const generateTemplate = (entryPoint) => {
  const parts = entryPoint.split(':');

  /* eslint-disable no-template-curly-in-string */
  const protoLine = '`${__dirname}/containerIO.proto`';
  // const indeterminateTypeLine = '`Unable to determine data type for: ${payloadType}`';
  /* eslint-enable no-template-curly-in-string */

  return ` const grpc = require('@grpc/grpc-js');
const protoLoader = require('@grpc/proto-loader');

const userModule = require('./${parts[0]}');

const PROTO_PATH = ${protoLine};
const packageDefinition = protoLoader.loadSync(
  PROTO_PATH,
  {
    keepCase: true,
    longs: String,
    enums: String,
    defaults: true,
  },
);

const containerIO = grpc.loadPackageDefinition(packageDefinition).mdsCloud.dockerMinion;

const readyResultForTransmission = (data) => {
  if (data === null || data === undefined) {
    return ''
  }
  return JSON.stringify(data);
};

const readyArgForUsage = (payload) => {
  if (payload) {
    return JSON.parse(payload);
  }
  return null;
};

const processHandler = (call, callback) => {
  try {
    userPayload = readyArgForUsage(
      call.request.userPayload,
    );
    const result = userModule.${parts[1]}(userPayload);
    console.dir({
      mod: '${parts[1]}',
      payload: call.request,
    });

    if (result && result.then && typeof result.then === 'function') {
      console.log('in then code');
      result
        .then((innerResult) => {
          const responseMapping = readyResultForTransmission(innerResult);
          callback(null, { userResponse: responseMapping });
        })
        .catch((err) => callback(err, null));
    } else {
      console.log('in direct result code');
      const responseMapping = readyResultForTransmission(result);
      callback(null, { userResponse: responseMapping });
    }
  } catch (err) {
    callback(err, null);
  }
};

const versionHandler = (call, callback) => {
  callback(null, { version: '1.0.0' });
};

const main = () => {
  const server = new grpc.Server();
  server.addService(containerIO.Interchange.service, {
    version: versionHandler,
    process: processHandler,
  })
  server.bindAsync('0.0.0.0:50051', grpc.ServerCredentials.createInsecure(), () => {
    server.start();
  })
};

main();
`;
};

module.exports = {
  generateTemplate,
};
