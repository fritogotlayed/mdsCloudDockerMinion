import config from 'config';
import { some } from 'lodash';
import { lookup } from 'dns/promises';
import { pack } from 'tar-fs';
import { DateTime } from 'luxon';
import { MdsSdk } from '@maddonkeysoftware/mds-cloud-sdk-node';
import { decode } from 'jsonwebtoken';

import { getLogger } from '../presentation/logging';
import { getRuntimeTools } from './runtimeTools';
import { ContainerManager } from './container-manager';
import { GrpcClient } from '../infrastructure/grpc/client';
import { BaseLogger } from 'pino';
import { FunctionMetadata, FunctionsRepo } from './interfaces/functions-repo';
import { FunctionsRepoMongo } from '../infrastructure/repos/functions-repo-mongo';
import { DockerRepo } from './interfaces/docker-repo';
import { DockerRepoImpl } from '../infrastructure/repos/docker-repo-impl';
import { SourceRepo } from './interfaces/source-repo';
import { SourceRepoImpl } from '../infrastructure/repos/source-repo-impl';

type ContainerMeta = {
  containerHost: string;
  fullTagName: string;
  tagVersion: string;
  functionName: string;
};

function safeConfigGet(
  key: string,
  defaultValue?: string | null,
): string | null | undefined {
  return config.has(key) ? config.get<string>(key) : defaultValue;
}

function isValidIpAddress(ipAddress: string): boolean {
  // https://www.regextester.com/22
  return /^(?<trash1>(?<trash2>[0-9]|[1-9][0-9]|1[0-9]{2}|2[0-4][0-9]|25[0-5])\.){3}(?<trash3>[0-9]|[1-9][0-9]|1[0-9]{2}|2[0-4][0-9]|25[0-5])$/.test(
    ipAddress,
  );
}

// TODO: separate infrastructure from logic
export class Logic {
  #containerManager: ContainerManager;
  #dockerRepo: DockerRepo;
  #functionsRepo: FunctionsRepo;
  #grpcClient: GrpcClient;
  #logger: BaseLogger;
  #sourceRepo: SourceRepo;

  resolvedContainerHost: undefined | string;

  constructor({
    containerManager,
    dockerRepo,
    functionsRepo,
    grpcClient,
    logger,
    sourceRepo,
  }: {
    containerManager?: ContainerManager;
    dockerRepo?: DockerRepo;
    functionsRepo?: FunctionsRepo;
    grpcClient?: GrpcClient;
    logger?: BaseLogger;
    sourceRepo?: SourceRepo;
  } = {}) {
    this.#containerManager = containerManager ?? new ContainerManager();
    this.#dockerRepo = dockerRepo ?? new DockerRepoImpl();
    this.#functionsRepo = functionsRepo ?? new FunctionsRepoMongo();
    this.#grpcClient = grpcClient ?? new GrpcClient();
    this.#logger = logger ?? getLogger();
    this.#sourceRepo = sourceRepo ?? new SourceRepoImpl();
  }

  async getContainerHost() {
    if (this.resolvedContainerHost) return this.resolvedContainerHost;

    const containerHostEnv = safeConfigGet('registry.address', undefined);
    if (containerHostEnv) {
      const [host, port] =
        containerHostEnv.indexOf(':') > -1
          ? containerHostEnv.split(':')
          : [containerHostEnv, '80'];

      try {
        if (isValidIpAddress(host)) {
          this.resolvedContainerHost = `${host}:${port}/`;
          return this.resolvedContainerHost;
        }

        const discoveredIp = await lookup(host);
        this.resolvedContainerHost = `${discoveredIp.address}:${port}/`;
        return this.resolvedContainerHost;
      } catch (err) {
        this.#logger.warn(
          { err },
          'Failed to find DNS resolution of container host.',
        );
        this.resolvedContainerHost = `${containerHostEnv}/`;
        return this.resolvedContainerHost;
      }
    }

    return '';
  }

  async buildImage(
    localPath: string,
    funcMetadata: FunctionMetadata,
  ): Promise<ContainerMeta> {
    const containerHost = await this.getContainerHost();
    const fullTagName =
      `${containerHost}mds-sf-${funcMetadata.accountId}/${funcMetadata.name}`.toLowerCase();
    const tagVersion = funcMetadata.nextVersion ?? funcMetadata.version ?? 1;
    const tarStream = pack(localPath);

    try {
      await this.#dockerRepo.buildImage(tarStream, {
        t: `${fullTagName}:${tagVersion}`,
        dockerfile: 'MdsDockerfile',
      });

      return {
        containerHost,
        fullTagName,
        tagVersion: tagVersion.toString(),
        functionName: funcMetadata.name,
      };
    } catch (err) {
      this.#logger.error({ err }, 'Failed to build docker image');
      throw new Error('Failed to build docker image.');
    }
  }

  async pushImageToRegistry({ fullTagName, tagVersion }: ContainerMeta) {
    await this.#dockerRepo.pushImage(fullTagName, tagVersion);
  }

  async removeImageLocally({
    fullTagName,
    tagVersion,
  }: {
    fullTagName: string;
    tagVersion: string | number;
  }) {
    try {
      await this.#dockerRepo.removeLocalImage(fullTagName, tagVersion);
    } catch (err) {
      this.#logger.warn(
        { err },
        'Error encountered when removing image locally',
      );
    }
  }

  async createFunction({
    name,
    accountId,
  }: {
    name: string;
    accountId: string | number;
  }) {
    const newId = await this.#functionsRepo.createFunction({
      name,
      accountId,
    });
    return {
      exists: !newId,
      id: newId,
    };
  }

  listFunctions() {
    return this.#functionsRepo.listFunctions();
  }

  /**
   * Builds a function container from the provided metadata.
   * @param functionId the id of the function to build
   * @param localFilePath the path to the local source archive
   * @param runtime the runtime to execute the source
   * @param entryPoint the starting point for code execution
   * @param context context to send to the remote procedure
   */
  async buildFunction({
    functionId,
    localFilePath,
    runtime,
    entryPoint,
    context,
  }: {
    functionId: string;
    localFilePath: string;
    runtime: string;
    entryPoint: string;
    context?: string;
  }) {
    // TODO: handle concurrent builds idempotent-ly
    // TODO: separate out items that interact with filesystem from logic
    let sourcePath: string | undefined;
    try {
      const metadata = await this.#functionsRepo.getFunctionInfo(functionId);

      this.#logger.trace({ localFilePath }, 'Extracting source');
      sourcePath = await this.#sourceRepo.extractSource(localFilePath);

      const tools = getRuntimeTools(runtime);
      const sourceRootPath = await tools.findEntrypoint(sourcePath);
      this.#logger.debug({ sourceRootPath }, 'Source extraction complete');

      await tools.prepSourceForContainerBuild(
        sourceRootPath,
        entryPoint,
        context,
      );
      const containerMeta = await this.buildImage(sourceRootPath, metadata);
      this.#logger.debug(
        {
          sourceRootPath,
          metadata,
          containerMeta,
        },
        'Container build complete.',
      );

      await this.#dockerRepo.pushImage(
        containerMeta.fullTagName,
        containerMeta.tagVersion,
      );
      // TODO: Determine if we should do this anymore
      // await this.removeImageLocally(containerMeta);

      await this.#functionsRepo.updateFunctionInfo({
        id: functionId,
        lastUpdate: DateTime.now().toISO() as string,
        containerHost: containerMeta.containerHost,
        fullTagName: containerMeta.fullTagName,
        tagVersion: containerMeta.tagVersion,
        incrementVersion: true,
      });
    } catch (err) {
      this.#logger.warn({ err }, 'Function build logic failed.');
      throw err;
    } finally {
      if (sourcePath) {
        await this.#sourceRepo.cleanupSource(sourcePath);
      }
      this.#logger.debug('function build complete.');
    }
  }

  async executeFunction(functionId: string, input: string): Promise<unknown> {
    try {
      const metadata = await this.#functionsRepo.getFunctionInfo(functionId);
      this.#logger.debug(
        { metadata },
        'Function metadata fetch for execution complete',
      );

      // START CONTAINER
      const containerData =
        await this.#containerManager.readyFunctionContainerForImage(
          metadata.fullTagName as string,
          metadata.tagVersion as string,
        );
      try {
        // CALL AND GET RESPONSE
        // TODO: Implement runtime limits
        this.#logger.debug(
          { accountId: metadata.accountId },
          'Attempting to get impersonation token for account.',
        );
        const identityClient = await MdsSdk.getIdentityServiceClient();
        const impersonateResponse = await identityClient.impersonateUser({
          accountId: metadata.accountId,
        });
        const { userId } = decode(impersonateResponse.token) as {
          userId: string;
        };

        this.#logger.debug(
          {
            ip: containerData.ip,
            containerData,
          },
          'Container started. Attempting to invoke function',
        );
        const startTs = DateTime.utc().toMillis();
        const invokeResult = await this.#grpcClient.invoke({
          hostIp: containerData.ip,
          payload: input,
          userId,
          userToken: impersonateResponse.token,
        });
        const endTs = DateTime.utc().toMillis();
        this.#logger.debug(
          { startTs, endTs, diffMs: endTs - startTs },
          'Function execution finished.',
        );
        return invokeResult;
      } catch (err) {
        this.#logger.warn(
          { err },
          'Error raised from container when invoking function',
        );
        const retryableErrors = [
          'Could not connect to provided IP',
          'Call cancelled',
        ];
        if (
          some(
            retryableErrors,
            (msg: string) => (err as Error).message.indexOf(msg) > -1,
          )
        ) {
          this.#logger.warn('Trying to re-obtain container details and re-run');
          return this.executeFunction(functionId, input);
        }
        throw err;
      } finally {
        this.#containerManager.releaseFunctionContainer(containerData.handle);
      }
    } catch (err) {
      this.#logger.warn({ err }, 'Error when invoking function');
      throw err;
    }
  }

  async removeFunction(functionId: string) {
    await this.#functionsRepo.removeFunction(functionId);
  }
}
