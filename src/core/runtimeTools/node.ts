import { readdir, readFile, writeFile } from 'fs/promises';
import { join } from 'path';
import { RuntimeTools } from './types/runtime-tools';
import { getLogger } from '../../presentation/logging';
import { map, merge } from 'lodash';
import { generateEntryPointBody } from './templates/node/entry-point';
import { generateDockerfileBody } from './templates/node/dockerfile';
import { generateProtobufFiles } from './templates/node/proto-setup';
import config from 'config';

export class NodeRuntimeTools implements RuntimeTools {
  async findEntrypoint(dir: string): Promise<string> {
    const files = await readdir(dir);
    if (files.length === 0) {
      throw new Error('Empty directory detected');
    }

    if (files.indexOf('package.json') > -1) {
      return dir;
    }

    // TODO: Figure out if this is a valid use case or should be rejected
    return join(dir, files[0]);
  }

  async prepSourceForContainerBuild(
    localPath: string,
    entryPoint: string,
    userContext?: string,
  ): Promise<void> {
    const logger = getLogger();

    try {
      // Install required dependencies
      const packageJsonPath = join(localPath, 'package.json');
      const data = await readFile(packageJsonPath);
      const packageJson = JSON.parse(data.toString());
      const newPackageJson = merge(packageJson, {
        dependencies: {
          '@grpc/grpc-js': '^1.2.6',
          '@grpc/proto-loader': '^0.5.6',
        },
      });
      await writeFile(packageJsonPath, JSON.stringify(newPackageJson, null, 2));

      // Generate entry file
      const entryFilePath = join(localPath, 'mdsEntry.js');
      const renderedTemplate = generateEntryPointBody({
        entryPoint,
        userContext,
        identityUrl: config.get<string>('mdsSdk.identityUrl'),
      });
      await writeFile(entryFilePath, renderedTemplate);

      // Generate Dockerfile
      const dockerfilePath = join(localPath, 'MdsDockerfile');
      await writeFile(dockerfilePath, generateDockerfileBody('mdsEntry.js'));

      // Generate protobuf required files
      const files = generateProtobufFiles();
      const promises = map(files, (contents, filename) => {
        const filePath = join(localPath, filename);
        return writeFile(filePath, contents);
      });

      await Promise.all(promises);
    } catch (err) {
      logger.error(
        { err },
        'Failed when preparing source for container build.',
      );
      throw err;
    }
  }
}
