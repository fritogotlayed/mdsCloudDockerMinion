const _ = require('lodash');
const dns = require('dns');
const fs = require('fs');
const os = require('os');
const path = require('path');
const unzipper = require('unzipper');
const shelljs = require('shelljs');
const util = require('util');
const tar = require('tar-fs');
const luxon = require('luxon');
const mdsSdk = require('@maddonkeysoftware/mds-cloud-sdk-node');
const jwt = require('jsonwebtoken');

const repo = require('./repo');
const globals = require('./globals');
const helpers = require('./helpers');
const runtimeTools = require('./runtimeTools');
const grpcClient = require('./grpc/client');
const containerManager = require('./containerManager');

const self = {
  createTempDirectory: async () => fs.mkdtempSync(`${os.tmpdir()}${path.sep}`),

  // TODO: Rename to "cleanupFileOrDirectory"
  cleanupDirectory: async (dirPath) => shelljs.exec(`rm -rf ${dirPath}`),

  /**
   * Expands a zip file containing source code to a new location then removes the zip file.
   * @param {String} localZipPath The full path to the zip file needing expansion.
   * @returns {String} The location of the expanded zip file contents.
   */
  extractSourceToPath: (localZipPath) =>
    new Promise((resolve, reject) => {
      const logger = globals.getLogger();
      self.createTempDirectory().then((extractedSourceDir) => {
        try {
          fs.createReadStream(localZipPath)
            .pipe(unzipper.Extract({ path: extractedSourceDir }))
            .on('error', (err) => {
              logger.warn({ err }, 'Error extracting zip.');
              reject(err);
            })
            .on('close', () => {
              logger.trace('Extract complete. Removing zip file.');
              fs.unlink(localZipPath, () => {
                logger.trace('Deleting zip file. Finding entry point.');
                resolve(extractedSourceDir);
              });
            });
        } catch (err) {
          reject(err);
        }
      });
    }),

  // https://www.regextester.com/22
  isValidIpAddress: (ipAddress) =>
    /^(?<trash1>(?<trash2>[0-9]|[1-9][0-9]|1[0-9]{2}|2[0-4][0-9]|25[0-5])\.){3}(?<trash3>[0-9]|[1-9][0-9]|1[0-9]{2}|2[0-4][0-9]|25[0-5])$/.test(
      ipAddress,
    ),

  resolvedContainerHost: undefined,

  clearContainerHost: () => {
    self.resolvedContainerHost = undefined;
  },

  getContainerHost: async () => {
    if (self.resolvedContainerHost) return self.resolvedContainerHost;

    const containerHostEnv = helpers.getEnvVar('MDS_FN_CONTAINER_HOST');
    if (containerHostEnv) {
      const [host, port] =
        containerHostEnv.indexOf(':') > -1
          ? containerHostEnv.split(':')
          : [containerHostEnv, '80'];

      try {
        if (self.isValidIpAddress(host)) {
          self.resolvedContainerHost = `${host}:${port}/`;
          return self.resolvedContainerHost;
        }
        const lookup = util.promisify(dns.lookup);
        const discoveredIp = await lookup(host);
        self.resolvedContainerHost = `${discoveredIp.address}:${port}/`;
        return self.resolvedContainerHost;
      } catch (err) {
        const logger = globals.getLogger();
        logger.warn(
          { err },
          'Failed to find DNS resolution of container host.',
        );
        self.resolvedContainerHost = `${containerHostEnv}/`;
        return self.resolvedContainerHost;
      }
    }
    return '';
  },

  // TODO: rewrite to async/await
  buildImage: (localPath, funcMetadata) =>
    new Promise((resolve, reject) => {
      self.getContainerHost().then((containerHost) => {
        const docker = globals.getDockerInterface();
        const fullTagName =
          `${containerHost}mds-sf-${funcMetadata.accountId}/${funcMetadata.name}`.toLowerCase();
        const tagVersion = funcMetadata.nextVersion || funcMetadata.version;
        const tarStream = tar.pack(localPath);
        docker
          .buildImage(tarStream, {
            t: `${fullTagName}:${tagVersion}`,
            dockerfile: 'MdsDockerfile',
          })
          .then(
            (stream) =>
              new Promise((streamResolve, streamReject) => {
                docker.modem.followProgress(stream, (err, res) => {
                  if (err) {
                    streamReject(err);
                  } else {
                    streamResolve(res);
                  }
                });
              }),
          )
          .then(() => {
            resolve({
              containerHost,
              fullTagName,
              tagVersion,
              functionName: funcMetadata.name,
            });
          })
          .catch((err) => {
            const logger = globals.getLogger();
            logger.error({ err }, 'Failed to build docker image');
            reject(new Error('Failed to build docker image.'));
          });
      });
    }),

  /**
   *
   * @param {object} metadata
   * @param {string} metadata.fullTagName
   * @param {string|Number} metadata.tagVersion
   * @param {string} metadata.containerHost
   * @example
   * pushImageToRegistry({
   *   fullTagName: '127.0.0.1:5000/foo/bar',
   *   tagVersion: 2,
   *   containerHost: '127.0.0.1:5000',
   * })
   * @returns {Promise<void>}
   */
  pushImageToRegistry: (metadata) =>
    new Promise((resolve, reject) => {
      const docker = globals.getDockerInterface();
      const image = docker.getImage(
        `${metadata.fullTagName}:${metadata.tagVersion}`,
      );
      const opts = {
        registry: metadata.containerHost,
      };
      image
        .push(opts)
        .then((stream) => {
          docker.modem.followProgress(stream, (err, res) => {
            if (err) {
              reject(err);
            } else {
              resolve(res);
            }
          });
        })
        .catch((err) => {
          reject(err);
        });
    }),

  /**
   *
   * @param {object} metadata
   * @param {string} metadata.fullTagName
   * @param {string|Number} metadata.tagVersion
   * @example
   * removeImageLocally({
   *   fullTagName: '127.0.0.1:5000/foo/bar',
   *   tagVersion: 2,
   * })
   * @returns {Promise<void>}
   */
  removeImageLocally: async (metadata) => {
    const docker = globals.getDockerInterface();
    const image = docker.getImage(
      `${metadata.fullTagName}:${metadata.tagVersion}`,
    );
    const opts = {
      // registry: metadata.containerHost,
    };

    try {
      await image.remove(opts);
    } catch (err) {
      const logger = globals.getLogger();
      logger.warn({ err }, 'Error encountered when removing image locally');
    }

    return undefined;
  },

  createFunction: async (data) => {
    const options = {
      writeConcern: {
        w: 'majority',
        j: true,
        wtimeout: 30000, // milliseconds
      },
    };

    const db = await repo.getDatabase();
    try {
      const functionsCol = db.getCollection('functions');

      const findResult = await functionsCol.findOne({
        name: data.name,
        accountId: data.accountId,
        deletedOn: { $exists: false },
      });

      if (findResult) {
        return {
          exists: true,
        };
      }

      const newId = `${globals.generateRandomString(32)}`;
      const newItem = {
        id: newId,
        accountId: data.accountId,
        name: data.name,
        created: luxon.DateTime.utc().toString(),
        nextVersion: 1,
        maxProcesses: 3,
      };

      await functionsCol.insertOne(newItem, options);
      return {
        exists: false,
        id: newId,
      };
    } finally {
      db.close();
    }
  },

  listFunctions: async () => {
    const logger = globals.getLogger();
    const database = await repo.getDatabase();
    const funcCol = database.getCollection('functions');
    const metadata = await funcCol
      .find({
        deletedOn: { $exists: false },
      })
      .toArray();

    try {
      logger.debug({ metadata }, 'Function metadata fetch for list complete');

      return _.map(metadata, (elem) => ({
        id: elem.id,
        accountId: elem.accountId,
        name: elem.name,
        created: elem.created,
      }));
    } catch (err) /* istanbul ignore next */ {
      logger.warn({ err }, 'Error occurred when listing functions');
      throw err;
    } finally {
      await database.close();
    }
  },

  /**
   * Builds a function container from the provided metadata.
   * @param {object} meta argument object
   * @param {string} meta.functionId The id of the function to build
   * @param {string} meta.localFilePath The path to the local source archive
   * @param {string} meta.runtime The runtime to execute the source
   * @param {string} meta.entryPoint The starting point for code execution
   * @param {String} [meta.context] context to send to the remote procedure
   */
  buildFunction: async (meta) => {
    // TODO: handle concurrent builds idempotent-ly
    const logger = globals.getLogger();
    const database = await repo.getDatabase();

    const { functionId, localFilePath, runtime, entryPoint, context } = meta;

    let sourcePath;
    try {
      logger.trace('Database connection established.');

      const funcCol = database.getCollection('functions');
      const metadata = await funcCol.findOne({
        id: functionId,
        deletedOn: { $exists: false },
      });
      logger.debug({ metadata }, 'Function metadata fetch for build complete');

      if (!metadata) {
        throw new Error(`Could not find function ${functionId}.`);
      }

      logger.trace({ localFilePath }, 'Extracting source');
      // Use above variable so cleanup can happen after process finishes.
      sourcePath = await self.extractSourceToPath(localFilePath);

      const tools = runtimeTools.getRuntimeTools(runtime);
      const sourceRootPath = await tools.findEntrypoint(sourcePath);
      logger.debug({ sourceRootPath }, 'Source extraction complete');

      await tools.prepSourceForContainerBuild(
        sourceRootPath,
        entryPoint,
        context,
      );
      const containerMeta = await self.buildImage(sourceRootPath, metadata);
      logger.debug(
        { sourceRootPath, metadata, containerMeta },
        'Container build complete.',
      );

      await self.pushImageToRegistry(containerMeta);
      // TODO: Determine if we should do this anymore
      // await self.removeImageLocally(containerMeta);

      const updatePayload = {
        $set: {
          lastUpdate: new Date().toISOString(),
          containerHost: containerMeta.containerHost,
          fullTagName: containerMeta.fullTagName,
          tagVersion: containerMeta.tagVersion,
        },
        $inc: { nextVersion: 1 },
      };
      const options = {
        writeConcern: {
          w: 'majority',
          j: true,
          wtimeout: 30000, // milliseconds
        },
      };

      await funcCol.updateOne({ id: functionId }, updatePayload, options);
    } catch (err) {
      logger.warn({ err }, 'Function build logic failed.');
      throw err;
    } finally {
      await database.close();
      if (sourcePath) {
        await self.cleanupDirectory(sourcePath);
      }
      logger.debug('Function build complete.');
    }
  },

  executeFunction: async (functionId, input) => {
    const logger = globals.getLogger();
    const database = await repo.getDatabase();
    const funcCol = database.getCollection('functions');
    const metadata = await funcCol.findOne({
      id: functionId,
      deletedOn: { $exists: false },
    });

    if (!metadata) {
      throw new Error('function not found');
    }

    try {
      logger.debug(
        { metadata },
        'Function metadata fetch for execution complete',
      );

      // START CONTAINER
      const containerData =
        await containerManager.readyFunctionContainerForImage(
          metadata.fullTagName,
          metadata.tagVersion,
        );
      try {
        // CALL AND GET RESPONSE
        // TODO: Implement runtime limits
        logger.debug(
          { accountId: metadata.accountId },
          'Attempting to get impersonation token for account.',
        );
        const identityClient = await mdsSdk.getIdentityServiceClient();
        const impersonateResponse = await identityClient.impersonateUser({
          accountId: metadata.accountId,
        });
        if (!impersonateResponse.token) {
          throw impersonateResponse;
        }
        const { userId } = jwt.decode(impersonateResponse.token);

        logger.debug(
          {
            ip: containerData.ip,
            containerData,
          },
          'Container started. Attempting to invoke function',
        );
        const startTs = luxon.DateTime.utc();
        const invokeResult = await grpcClient.invoke({
          hostIp: containerData.ip,
          payload: input,
          userId,
          userToken: impersonateResponse.token,
        });
        const endTs = luxon.DateTime.utc();
        logger.debug(
          { startTs, endTs, diffMs: endTs - startTs },
          'Function execution finished.',
        );
        return invokeResult;
      } catch (err) {
        logger.warn(
          { err },
          'Error raised from container when invoking function',
        );
        const retryableErrors = [
          'Could not connect to provided IP',
          'Call cancelled',
        ];
        if (_.some(retryableErrors, (msg) => err.message.indexOf(msg) > -1)) {
          logger.warn('Trying to re-obtain container details and re-run');
          return self.executeFunction(functionId, input);
        }
        throw err;
      } finally {
        containerManager.releaseFunctionContainer(containerData.handle);
      }
    } catch (err) {
      logger.warn({ err }, 'Error when invoking function');
      throw err;
    }
  },

  removeFunction: async (functionId) => {
    const logger = globals.getLogger();
    const database = await repo.getDatabase();
    const funcCol = database.getCollection('functions');
    const metadata = await funcCol.findOne({
      id: functionId,
      deletedOn: { $exists: false },
    });

    if (!metadata) {
      throw new Error('function not found');
    }

    try {
      logger.debug(
        { metadata },
        'Function metadata fetch for removal complete',
      );

      const updatePayload = {
        $set: {
          deletedOn: new Date().toISOString(),
        },
      };
      const options = {
        writeConcern: {
          w: 'majority',
          j: true,
          wtimeout: 30000, // milliseconds
        },
      };

      await funcCol.updateOne({ id: functionId }, updatePayload, options);
    } catch (err) {
      logger.warn({ err }, 'Error when removing function.');
      throw err;
    }
  },
};

module.exports = self;
