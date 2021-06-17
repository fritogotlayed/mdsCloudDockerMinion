/**
 * @typedef {Function} FindEntrypoint
 * @param {string} dir the directory to begin finding the entry point at
 */

/**
  * @typedef {Function} PrepSourceForContainerBuild
  * @param {string} localPath the root location for the source code
  * @param {string} entryPoint the path and function to execute when executing the function
  */

/**
 * @typedef {Object} RuntimeTools
 * @property {FindEntrypoint} findEntrypoint
 * @property {PrepSourceForContainerBuild} prepSourceForContainerBuild
 */

/**
 * Get tools to facilitate builds for specific languages
 * @param {String} runtime The runtime to load tools for
 * @returns {RuntimeTools}
 */
const getRuntimeTools = (runtime) => {
  switch (runtime.toUpperCase()) {
    case 'NODE':
      // eslint-disable-next-line global-require
      return require('./node');
    case 'PYTHON':
      // eslint-disable-next-line global-require
      return require('./python');
    default:
      throw new Error(`Runtime "${runtime}" not understood.`);
  }
};

module.exports = {
  getRuntimeTools,
};
