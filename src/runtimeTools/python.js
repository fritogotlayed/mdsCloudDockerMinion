/* istanbul ignore file */
// TODO: This is a WIP file and Python is not currently supported
const fs = require('fs');
const path = require('path');
const shelljs = require('shelljs');

const globals = require('../globals');
const entryPointTemplate = require('../templates/python/fnProjectEntryPoint');
const dockerfileTemplate = require('../templates/python/fnProjectDockerfile');

const findEntrypoint = (dir) =>
  new Promise((resolve, reject) => {
    fs.readdir(dir, (err, files) => {
      if (files.length === 0) {
        return reject(new Error('No files found in directory.'));
      }

      if (files.indexOf('requirements.txt') > -1) {
        return resolve(dir);
      }

      // TODO: Figure out if this is a valid use case or should be rejected
      if (files.length === 1) {
        return resolve(`${dir}${path.sep}${files[0]}`);
      }
      return resolve(dir);
    });
  });

const prepSourceForContainerBuild = (localPath, entryPoint) =>
  new Promise((res, rej) => {
    const logger = globals.getLogger();
    const fdkInstallCmd =
      'touch requirements.txt && echo "\nfdk==0.1.21" >> requirements.txt';
    const entryPointFileName = 'mdsEntry.py';

    // Install provider entry point kit
    shelljs.exec(
      fdkInstallCmd,
      { cwd: localPath, silent: true },
      (retCode, sdtOut, stdErr) => {
        if (retCode === 0) {
          logger.debug({ localPath }, 'Installing FnProject fdk successful.');

          // Generate entry file
          const entryFilePath = `${localPath}${path.sep}${entryPointFileName}`;
          const renderedTemplate =
            entryPointTemplate.generateTemplate(entryPoint);
          fs.writeFile(entryFilePath, renderedTemplate, (err) => {
            if (err) {
              logger.error(
                { err, entryFilePath },
                'Writing entry point failed.',
              );
              rej(err);
            } else {
              logger.debug(
                { entryFilePath },
                'Writing entry point successful.',
              );

              // Generate Dockerfile
              const dockerFilePath = `${localPath}${path.sep}MdsDockerfile`;
              const templateBody =
                dockerfileTemplate.generateTemplate(entryPointFileName);
              fs.writeFile(dockerFilePath, templateBody, (err2) => {
                if (err2) {
                  logger.error(
                    { err2, dockerFilePath },
                    'Writing MdsDockerfile failed.',
                  );
                  rej(err2);
                } else {
                  logger.debug(
                    { dockerFilePath },
                    'Writing MdsDockerfile successful.',
                  );
                  res();
                }
              });
            }
          });
        } else {
          logger.error(
            {
              retCode,
              sdtOut,
              stdErr,
              localPath,
            },
            'Installing FDK failed.',
          );
          rej(new Error('Failed when preparing source for container build.'));
        }
      },
    );
  });

module.exports = {
  findEntrypoint,
  prepSourceForContainerBuild,
};
