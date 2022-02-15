const fs = require('fs');

/**
 * @returns key / value set of files to write
 */
const generateProtobufFiles = () => {
  const data = fs
    .readFileSync(`${__dirname}/../../grpc/protos/containerIO.proto`)
    .toString();

  return {
    'containerIO.proto': data,
  };
};

module.exports = {
  generateProtobufFiles,
};
