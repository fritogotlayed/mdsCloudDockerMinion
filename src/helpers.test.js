/* eslint-disable no-unused-expressions */

const _ = require('lodash');
const chai = require('chai');
const sinon = require('sinon');
const shelljs = require('shelljs');
const proxyquire = require('proxyquire');

const helpers = require('./helpers');

describe('src/helpers', () => {
  afterEach(() => {
    sinon.restore();
  });

  describe('getEnvVar', () => {
    it('Reads env vars', () => {
      const keys = ['NODE_ENV', 'NONEXISTENT'];
      _.map(keys, (k) => chai.expect(helpers.getEnvVar(k)).to.equal(process.env[k]));
    });
  });

  describe('shellExecute', () => {
    it('resolves return object with return code, standard out and standard error', async () => {
      // Arrange
      const expectedCommand = 'test-command';
      const expectedOptions = {};
      sinon.stub(shelljs, 'exec').callsFake((cmd, opts, cb) => {
        if (cmd !== expectedCommand || opts !== expectedOptions) {
          cb(-1, '', 'cmd or opts did not match expected parameter');
        }
        cb(0, 'std out data', 'std err data');
      });

      // Act
      const result = await helpers.shellExecute(expectedCommand, expectedOptions);

      // Assert
      chai.expect(result).to.deep.equal({
        retCode: 0,
        stdOut: 'std out data',
        stdErr: 'std err data',
      });
    });
  });

  describe('saveRequestFile', () => {
    it('resolves when file save successful', async () => {
      // Arrange
      const expectedPath = '/fake/path';
      const mockFile = {
        mv: sinon.stub().callsFake((newPath, cb) => {
          if (newPath === expectedPath) {
            return cb();
          }
          return cb(new Error('Path did not match expected path'));
        }),
      };

      // Act & Assert
      await helpers.saveRequestFile(mockFile, expectedPath);
    });

    it('rejects when file save unsuccessful', async () => {
      // Arrange
      const expectedPath = '/fake/path';
      const mockFile = {
        mv: sinon.stub().callsFake((newPath, cb) => cb(new Error('test failure'))),
      };

      // Act & Assert
      await helpers.saveRequestFile(mockFile, expectedPath).catch((err) => {
        if (err.message !== 'test failure') throw err;
      });
    });
  });

  describe('deleteFileOrPath', () => {
    it('Calls del library as passthrough', async () => {
      // Arrange
      const options = {};
      const delStub = sinon.stub();
      const proxiedHelpers = proxyquire('./helpers', {
        del: delStub,
      });

      // Act
      await proxiedHelpers.deleteFileOrPath('./testThing', options);

      // Assert
      chai.expect(delStub.callCount).to.be.equal(1);
      chai.expect(delStub.getCall(0).args).to.deep.equal([
        './testThing',
        options,
      ]);
    });
  });

  describe('downloadFile', () => {
    it('Passes through to request.download', async () => {
      // Arrange
      const mockRequest = {
        download: sinon.stub(),
      };

      // Act
      helpers.downloadFile(mockRequest, 'filePath', 'fileName', 'cb');

      // Assert
      chai.expect(mockRequest.download.callCount).to.be.equal(1);
      chai.expect(mockRequest.download.getCall(0).args).to.deep.equal([
        'filePath',
        'fileName',
        'cb',
      ]);
    });
  });
});
