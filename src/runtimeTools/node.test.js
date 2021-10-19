const chai = require('chai');
const sinon = require('sinon');
const chaiAsPromised = require('chai-as-promised');

const globals = require('../globals');
const nodeRuntimeTools = require('./node');
const common = require('./common');
const entryPointTemplate = require('../templates/node/entryPoint');
const dockerfileTemplate = require('../templates/node/dockerfile');
const protoSetupTemplate = require('../templates/node/protoSetup');

chai.use(chaiAsPromised);

describe(__filename, () => {
  afterEach(() => {
    sinon.restore();
  });

  describe('findEntrypoint', () => {
    it('when directory contains package.json returns directory', async () => {
      // Arrange
      const expectedDir = '/test/dir';
      sinon.stub(common, 'readdir').withArgs(expectedDir).resolves([
        'package.json',
      ]);

      // Act
      const result = await nodeRuntimeTools.findEntrypoint(expectedDir);

      // Assert
      chai.expect(result).to.be.equal(expectedDir);
    });

    it('when directory is empty error is thrown', async () => {
      // Arrange
      const testDir = '/test/dir';
      sinon.stub(common, 'readdir').withArgs(testDir).resolves([]);

      // Act
      try {
        await nodeRuntimeTools.findEntrypoint(testDir);
        throw new Error('test should have throw error but did not');
      } catch (err) {
        // Assert
        chai.expect(err.message).to.be.equal('Empty directory detected');
      }
    });

    it('when directory does not contains package.json returns best guess', async () => {
      // Arrange
      const expectedDir = '/test/dir';
      sinon.stub(common, 'readdir').withArgs(expectedDir).resolves([
        'dir1',
        'dir2',
        'file1',
      ]);

      // Act
      const result = await nodeRuntimeTools.findEntrypoint(expectedDir);

      // Assert
      chai.expect(result).to.be.equal(`${expectedDir}/dir1`);
    });
  });

  describe('prepSourceForContainerBuild', () => {
    it('Creates all the expected file in the source directory', async () => {
      // Arrange
      sinon.stub(common, 'readFile')
        .withArgs('localPath/package.json').resolves(JSON.stringify({}));
      sinon.stub(common, 'writeFile').resolves();

      // Act
      await nodeRuntimeTools.prepSourceForContainerBuild('localPath', 'entryPoint');

      // Assert
      chai.expect(common.writeFile.callCount).to.be.equal(4);
      chai.expect(common.writeFile.getCall(0).args).to.deep.equal([
        'localPath/package.json',
        JSON.stringify({
          dependencies: {
            '@grpc/grpc-js': '^1.2.6',
            '@grpc/proto-loader': '^0.5.6',
          },
        }, null, 2),
      ]);
      chai.expect(common.writeFile.getCall(1).args).to.deep.equal([
        'localPath/mdsEntry.js',
        entryPointTemplate.generateTemplate({
          entryPoint: 'entryPoint',
        }),
      ]);
      chai.expect(common.writeFile.getCall(2).args).to.deep.equal([
        'localPath/MdsDockerfile',
        dockerfileTemplate.generateTemplate('mdsEntry.js'),
      ]);

      const protoFiles = protoSetupTemplate.generateProtobufFiles();
      const keys = Object.keys(protoFiles);
      for (let i = 0; i < keys.length; i += 1) {
        const callIndex = 3 + i;
        chai.expect(common.writeFile.getCall(callIndex).args).to.deep.equal([
          `localPath/${keys[i]}`,
          protoFiles[keys[i]],
        ]);
      }
    });

    it('if error occurs logs and rethrows error', async () => {
      // Arrange
      const fakeLogger = {
        error: sinon.stub(),
      };
      const expectedError = new Error('test error');
      sinon.stub(globals, 'getLogger').returns(fakeLogger);
      sinon.stub(common, 'readFile').rejects(expectedError);

      // Act
      try {
        await nodeRuntimeTools.prepSourceForContainerBuild('localPath', 'entryPoint');
        throw new Error('Test should of throw error but did not');
      } catch (err) {
        // Assert
        chai.expect(err.message).to.be.equal('test error');
        chai.expect(fakeLogger.error.callCount).to.be.equal(1);
        chai.expect(fakeLogger.error.getCall(0).args).to.deep.equal([
          { err: expectedError },
          'Failed when preparing source for container build.',
        ]);
      }
    });
  });
});
