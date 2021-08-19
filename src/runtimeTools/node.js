const _ = require('lodash');
const path = require('path');

const common = require('./common');
const globals = require('../globals');
const entryPointTemplate = require('../templates/node/entryPoint');
const dockerfileTemplate = require('../templates/node/dockerfile');
const protoSetupTemplate = require('../templates/node/protoSetup');

const findEntrypoint = (dir) => common.readdir(dir)
  .then((files) => {
    if (files.length === 0) {
      throw new Error('Empty directory detected');
    }

    if (files.indexOf('package.json') > -1) {
      return dir;
    }

    // TODO: Figure out if this is a valid use case or should be rejected
    return `${dir}${path.sep}${files[0]}`;
  });

const prepSourceForContainerBuild = async (localPath, entryPoint, userContext) => {
  const logger = globals.getLogger();

  try {
    // Install required dependencies
    const packageJsonPath = `${localPath}${path.sep}package.json`;
    const data = await common.readFile(packageJsonPath);
    const packageJson = JSON.parse(data.toString());
    const newPackageJson = _.merge(
      packageJson,
      {
        dependencies: {
          '@grpc/grpc-js': '^1.2.6',
          '@grpc/proto-loader': '^0.5.6',
        },
      },
    );
    await common.writeFile(packageJsonPath, JSON.stringify(newPackageJson, null, 2));

    // Generate entry file
    const entryFilePath = `${localPath}${path.sep}mdsEntry.js`;
    const renderedTemplate = entryPointTemplate.generateTemplate(entryPoint, userContext);
    await common.writeFile(entryFilePath, renderedTemplate);

    // Generate Dockerfile
    const dockerFilePath = `${localPath}${path.sep}MdsDockerfile`;
    await common.writeFile(dockerFilePath, dockerfileTemplate.generateTemplate('mdsEntry.js'));

    // Generate protobuf required files
    const files = await protoSetupTemplate.generateProtobufFiles();
    const promises = _.map(files, (contents, fileName) => {
      const filePath = `${localPath}${path.sep}${fileName}`;
      return common.writeFile(filePath, contents);
    });
    await Promise.all(promises);
  } catch (err) {
    logger.error({ err }, 'Failed when preparing source for container build.');
    throw err;
  }
};

module.exports = {
  findEntrypoint,
  prepSourceForContainerBuild,
};
