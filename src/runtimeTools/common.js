/* istanbul ignore file */
const fs = require('fs');
const util = require('util');

const writeFile = util.promisify(fs.writeFile);
const readFile = util.promisify(fs.readFile);
const readdir = util.promisify(fs.readdir);

module.exports = {
  writeFile,
  readFile,
  readdir,
};
