import { SourceRepo } from '../../core/interfaces/source-repo';
import { createReadStream } from 'fs';
import { Extract } from 'unzipper';
import { mkdtemp, unlink } from 'fs/promises';
import { tmpdir } from 'os';
import { sep } from 'path';
import { exec } from 'shelljs';
import { BaseLogger } from 'pino';
import { getLogger } from '../../presentation/logging';

export class SourceRepoImpl implements SourceRepo {
  #logger: BaseLogger;

  constructor({ logger }: { logger?: BaseLogger } = {}) {
    this.#logger = logger ?? getLogger();
  }

  createTempDirectory() {
    return mkdtemp(`${tmpdir()}${sep}`);
  }

  cleanupSource(localSourcePath: string): Promise<void> {
    // TODO: sanity checking, etc.
    return new Promise((resolve) => {
      exec(`rm -rf ${localSourcePath}`);
      resolve();
    });
  }

  /**
   * Expands a zip file containing source code to a new location then removes the zip file.
   * @param localZipPath The full path to the zip file needing expansion.
   * @returns The location of the expanded zip file contents.
   */
  extractSource(localZipPath: string): Promise<string> {
    return new Promise((resolve, reject) => {
      this.createTempDirectory().then((extractedSourceDir) => {
        try {
          createReadStream(localZipPath)
            .pipe(Extract({ path: extractedSourceDir }))
            .on('error', (err: Error) => {
              this.#logger.warn({ err }, 'Error extracting zip.');
              reject(err);
            })
            .on('close', async () => {
              this.#logger.trace('Extract complete. Removing zip file.');
              await unlink(localZipPath);
              this.#logger.trace('Deleting zip file. Finding entry point.');
              resolve(extractedSourceDir);
            });
        } catch (err) {
          reject(err);
        }
      });
    });
  }
}
