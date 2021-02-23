const _ = require('lodash');
const shelljs = require('shelljs');
const del = require('del');

const globals = require('./globals');

/**
 * Provides a wrapper around process.env for testing
 * @param {string} key the environment variable key
 * @param {string} defaultValue the environment variable key
 * @returns {string} the environment variable value
 */
const getEnvVar = (key, defaultValue) => _.get(process.env, [key], defaultValue);

/**
 * @typedef {Object} ShellExecuteResult
 * @property {Number} retCode The return code from the shell execution
 * @property {String} stdOut The standard output stream text
 * @property {String} stdErr The standard error stream text
 */

/**
 * Execute a command on the shell and resolve when complete.
 * @param {*} command The command to execute
 * @param {*} options Shelljs options for execution.
 */
const shellExecute = (command, options) => new Promise((resolve) => {
  const logger = globals.getLogger();
  logger.trace({ command, options }, 'Invoking shell command');
  shelljs.exec(command, options, (retCode, stdOut, stdErr) => {
    resolve({ retCode, stdOut, stdErr });
  });
});

/**
 * Provides a wrapper around request file move for testing
 * @param {*} requestFile the file object from the request
 * @param {*} savePath the location to save the file
 */
const saveRequestFile = (requestFile, savePath) => new Promise((res, rej) => {
  requestFile.mv(savePath, (err) => {
    if (err) {
      rej(err);
    } else {
      res();
    }
  });
});

/**
 * Provides a wrapper around file / folder delete for testing
 * @param {*} fileOrPath the path to a file or folder
 * @param {*} options the delete options
 */
const deleteFileOrPath = (fileOrPath, options) => del(fileOrPath, options);

/**
 * Provides a wrapper around request file download for testing
 * @param {*} request the request to act upon
 * @param {*} filePath the path to the file to download
 * @param {*} filename the file name that the user will be provided
 * @param {*} callback the callback to indicate completion or failure
 */
const downloadFile = (request, filePath, filename, callback) => (
  request.download(filePath, filename, callback));

module.exports = {
  getEnvVar,
  shellExecute,
  saveRequestFile,
  deleteFileOrPath,
  downloadFile,
};
