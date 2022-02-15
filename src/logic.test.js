/* eslint-disable no-unused-expressions */

const chai = require('chai');
const sinon = require('sinon');
const chaiAsPromised = require('chai-as-promised');

const fs = require('fs');
const shelljs = require('shelljs');
const dns = require('dns');
const tar = require('tar-fs');
const mdsSdk = require('@maddonkeysoftware/mds-cloud-sdk-node');
const jwt = require('jsonwebtoken');

const globals = require('./globals');
const logic = require('./logic');
const repo = require('./repo');
const helpers = require('./helpers');
const runtimeTools = require('./runtimeTools');
const containerManager = require('./containerManager');
const grpcClient = require('./grpc/client');

chai.use(chaiAsPromised);

describe(__filename, () => {
  afterEach(() => {
    sinon.restore();
  });

  describe('createTempDirectory', () => {
    it('returns a new temp directory', () => {
      // Arrange
      sinon.stub(fs, 'mkdtempSync').returns('/tmp/abcdef');

      // Act
      return logic.createTempDirectory().then((temp) => {
        // Assert
        chai.expect(temp).to.equal('/tmp/abcdef');
      });
    });
  });

  describe('cleanupTempDirectory', () => {
    it('Passes through to shell to recursively cleanup directory', () => {
      // Arrange
      sinon.stub(shelljs, 'exec').withArgs('/tmp/abcdef').resolves();

      // Act
      return logic.cleanupDirectory('/tmp/abcdef').then(() => {
        chai.expect(shelljs.exec.callCount).to.be.equal(1);
      });
    });
  });

  describe('extractSourceToPath', () => {
    const metadata = {
      localPath: '/test/dir',
      runtime: 'testRuntime',
      container: {
        name: 'testContainer',
        path: 'testContainerPath',
      },
    };

    beforeEach(() => {
      const fakeLogger = {
        debug: sinon.stub(),
        trace: sinon.stub(),
        warn: sinon.stub(),
      };
      sinon.stub(globals, 'getLogger').returns(fakeLogger);
    });

    it('when successful extracts source and returns path to source', () => {
      // Arrange
      const fsStream = {};
      sinon.stub(logic, 'createTempDirectory').resolves('/tmp/abcdef');
      sinon.stub(fs, 'createReadStream').returns(fsStream);
      fsStream.pipe = sinon.stub().returns(fsStream);
      fsStream.on = sinon.stub().callsFake((event, cb) => {
        if (event === 'close') {
          globals.delay(1).then(() => {
            cb();
          });
        }
        return fsStream;
      });
      sinon.stub(fs, 'unlink').callsFake((localPath, cb) => {
        globals.delay(1).then(() => cb());
      });

      // Act
      return chai
        .expect(logic.extractSourceToPath(metadata))
        .to.eventually.be.fulfilled.then((path) => {
          chai.expect(path).to.equal('/tmp/abcdef');
        });
    });

    it('when fs stream errors rejects with error', () => {
      // Arrange
      const fsStream = {};
      sinon.stub(logic, 'createTempDirectory').resolves('/tmp/abcdef');
      sinon.stub(fs, 'createReadStream').returns(fsStream);
      fsStream.pipe = sinon.stub().returns(fsStream);
      fsStream.on = sinon.stub().callsFake((event, cb) => {
        if (event === 'error') {
          globals.delay(1).then(() => {
            cb(new Error('test error'));
          });
        }
        return fsStream;
      });

      // Act
      return chai
        .expect(logic.extractSourceToPath(metadata))
        .to.eventually.be.rejectedWith('test error');
    });

    it('when error thrown rejects with error', () => {
      // Arrange
      sinon.stub(logic, 'createTempDirectory').resolves('/tmp/abcdef');
      sinon.stub(fs, 'createReadStream').throws(new Error('test error'));

      // Act & Assert
      return chai
        .expect(logic.extractSourceToPath(metadata))
        .to.eventually.be.rejectedWith('test error');
    });
  });

  describe('buildImage', () => {
    const localPath = '/test/dir';
    const metadata = {
      accountId: 1,
      nextVersion: 2,
      name: 'testFunc',
      runtime: 'testRuntime',
      entryPoint: 'index:main',
      container: {
        name: 'testContainer',
        path: 'testContainerPath',
      },
    };

    it('when build success resolves with expected data', () => {
      // Arrange
      sinon.stub(logic, 'getContainerHost').resolves('containerHost/');
      const tarStreamStub = {};
      sinon.stub(tar, 'pack').returns(tarStreamStub);
      const imageStreamStub = {};
      const dockerStub = {
        buildImage: sinon.stub().resolves(imageStreamStub),
        modem: {
          followProgress: (stream, cb) => {
            cb(undefined, {});
          },
        },
      };
      sinon.stub(globals, 'getDockerInterface').returns(dockerStub);

      // Act
      return chai
        .expect(logic.buildImage(localPath, metadata))
        .to.eventually.be.fulfilled.then((data) => {
          chai.expect(data).to.deep.equal({
            containerHost: 'containerHost/',
            fullTagName: 'containerhost/mds-sf-1/testfunc',
            functionName: 'testFunc',
            tagVersion: 2,
          });
        });
    });

    it('rejects when build fails', () => {
      // Arrange
      sinon.stub(logic, 'getContainerHost').resolves('containerHost/');
      const tarStreamStub = {};
      sinon.stub(tar, 'pack').returns(tarStreamStub);
      const imageStreamStub = {};
      const dockerStub = {
        buildImage: sinon.stub().resolves(imageStreamStub),
        modem: {
          followProgress: (stream, cb) => {
            cb(new Error('test error'), undefined);
          },
        },
      };
      sinon.stub(globals, 'getDockerInterface').returns(dockerStub);

      // Act
      return chai
        .expect(logic.buildImage(localPath, metadata))
        .to.eventually.be.rejectedWith('Failed to build docker image.');
    });
  });

  describe('pushImageToRegistry', () => {
    const metadata = {
      tagPrefix: 'testTagPrefix',
      tagVersion: 1,
    };

    it('resolves after image push successful', () => {
      // Arrange
      const imageStub = {
        push: sinon.stub().resolves(),
      };
      const dockerStub = {
        getImage: sinon.stub().returns(imageStub),
        modem: {
          followProgress: (stream, cb) => {
            cb(undefined, {});
          },
        },
      };
      sinon.stub(globals, 'getDockerInterface').returns(dockerStub);

      // Act
      return chai.expect(logic.pushImageToRegistry(metadata)).to.eventually.be
        .fulfilled;
    });

    it('rejects after image push unsuccessful', () => {
      // Arrange
      const imageStub = {
        push: sinon.stub().resolves(),
      };
      const dockerStub = {
        getImage: sinon.stub().returns(imageStub),
        modem: {
          followProgress: (stream, cb) => {
            cb(new Error('test error'), undefined);
          },
        },
      };
      sinon.stub(globals, 'getDockerInterface').returns(dockerStub);

      // Act
      return chai.expect(logic.pushImageToRegistry(metadata)).to.eventually.be
        .rejected;
    });

    it('rejects after image push raises error', () => {
      // Arrange
      const imageStub = {
        push: sinon.stub().rejects(new Error('test error')),
      };
      const dockerStub = {
        getImage: sinon.stub().returns(imageStub),
      };
      sinon.stub(globals, 'getDockerInterface').returns(dockerStub);

      // Act
      return chai.expect(logic.pushImageToRegistry(metadata)).to.eventually.be
        .rejected;
    });
  });

  describe('removeImageLocally', () => {
    const metadata = {
      fullTagName: 'testTagPrefix',
      tagVersion: 1,
    };

    it('resolves after command executes successfully', () => {
      // Arrange
      const imageStub = {
        remove: sinon.stub().resolves(),
      };
      const dockerStub = {
        getImage: sinon.stub().returns(imageStub),
      };
      sinon.stub(globals, 'getDockerInterface').returns(dockerStub);

      // Act
      return chai.expect(logic.removeImageLocally(metadata)).to.eventually.be
        .fulfilled;
    });

    it('resolves after command fails and message logged', () => {
      // Arrange
      const fakeLogger = {
        warn: sinon.stub(),
      };
      const imageStub = {
        remove: sinon.stub().rejects(new Error('test error')),
      };
      const dockerStub = {
        getImage: sinon.stub().returns(imageStub),
      };
      sinon.stub(globals, 'getDockerInterface').returns(dockerStub);
      sinon.stub(globals, 'getLogger').returns(fakeLogger);

      // Act
      return chai
        .expect(logic.removeImageLocally(metadata))
        .to.eventually.be.fulfilled.then(() => {
          chai.expect(fakeLogger.warn.callCount).to.equal(1);
        });
    });
  });

  describe('buildFunction', () => {
    const eventData = {
      functionId: 'testFuncId',
      localFilePath: '/tmp/abcdef',
      runtime: 'testRuntime',
    };

    it('updates data store and provider successfully when function exists', () => {
      // Arrange
      const dbFuncMetadata = {};
      const containerMeta = {};
      const runtimeToolsFake = {
        prepSourceForContainerBuild: sinon.stub().resolves(),
        findEntrypoint: sinon.stub().resolves(),
      };

      const funcColStub = {
        findOne: sinon
          .stub()
          .withArgs(sinon.match({ id: eventData.functionId }))
          .resolves(dbFuncMetadata),
        updateOne: sinon.stub().resolves(),
      };
      sinon.stub(repo, 'getDatabase').resolves({
        close: () => Promise.resolve(),
        getCollection: () => funcColStub,
      });
      sinon
        .stub(logic, 'extractSourceToPath')
        .withArgs('/tmp/abcdef')
        .resolves('/tmp/sourcePath');
      sinon
        .stub(runtimeTools, 'getRuntimeTools')
        .withArgs('testRuntime')
        .returns(runtimeToolsFake);
      sinon.stub(logic, 'buildImage').resolves(containerMeta);
      sinon.stub(logic, 'pushImageToRegistry').resolves();
      sinon
        .stub(logic, 'cleanupDirectory')
        .withArgs('/tmp/sourcePath')
        .resolves();

      // Act
      return chai.expect(logic.buildFunction(eventData)).to.eventually.be
        .fulfilled;
    });

    it('logs and throws when error occurs', () => {
      const fakeLogger = {
        debug: sinon.stub(),
        trace: sinon.stub(),
        warn: sinon.stub(),
      };
      const funcColStub = {
        findOne: sinon
          .stub()
          .withArgs(sinon.match({ id: eventData.functionId }))
          .resolves({}),
        updateOne: sinon.stub().resolves(),
      };
      sinon.stub(globals, 'getLogger').returns(fakeLogger);
      sinon.stub(repo, 'getDatabase').resolves({
        close: () => Promise.resolve(),
        getCollection: () => funcColStub,
      });
      sinon
        .stub(logic, 'extractSourceToPath')
        .withArgs('/tmp/abcdef')
        .resolves('/tmp/sourcePath');
      sinon
        .stub(runtimeTools, 'getRuntimeTools')
        .withArgs('testRuntime')
        .throws(new Error('test error'));
      sinon.stub(logic, 'cleanupDirectory').withArgs('/tmp/abcdef').resolves();

      // Act
      return chai
        .expect(logic.buildFunction(eventData))
        .to.eventually.be.rejectedWith('test error')
        .then(() => {
          chai.expect(fakeLogger.warn.callCount).to.equal(1);
        });
    });

    it('raises error when function does not exist', async () => {
      const fakeLogger = {
        debug: sinon.stub(),
        trace: sinon.stub(),
        warn: sinon.stub(),
      };
      const funcColStub = {
        findOne: sinon
          .stub()
          .withArgs(sinon.match({ id: eventData.functionId }))
          .resolves(),
        updateOne: sinon.stub().resolves(),
      };
      sinon.stub(globals, 'getLogger').returns(fakeLogger);
      sinon.stub(repo, 'getDatabase').resolves({
        close: () => Promise.resolve(),
        getCollection: () => funcColStub,
      });
      sinon
        .stub(logic, 'extractSourceToPath')
        .withArgs('/tmp/abcdef')
        .resolves('/tmp/sourcePath');
      sinon
        .stub(runtimeTools, 'getRuntimeTools')
        .withArgs('testRuntime')
        .throws(new Error('test error'));
      sinon.stub(logic, 'cleanupDirectory').withArgs('/tmp/abcdef').resolves();

      // Act
      try {
        await logic.buildFunction(eventData);
        throw new Error('test should of thrown an error but did not');
      } catch (err) {
        chai
          .expect(err.message)
          .to.be.equal(`Could not find function ${eventData.functionId}.`);
        chai.expect(fakeLogger.warn.callCount).to.equal(1);
      }
    });
  });

  describe('getContainerHost', () => {
    beforeEach(() => {
      logic.clearContainerHost();
    });

    it('resolves empty string when environment variable missing', async () => {
      // Arrange
      sinon
        .stub(helpers, 'getEnvVar')
        .withArgs('MDS_FN_CONTAINER_HOST')
        .returns(undefined);

      // Act
      const result = await logic.getContainerHost();

      // Assert
      chai.expect(result).to.be.equal('');
    });

    it('resolves with port 80 when no port specified', () => {
      // Arrange
      sinon
        .stub(helpers, 'getEnvVar')
        .withArgs('MDS_FN_CONTAINER_HOST')
        .returns('1.2.3.4');

      // Act
      return logic.getContainerHost().then((result1) => {
        // Assert
        chai.expect(result1).to.equal('1.2.3.4:80/');
      });
    });

    it('resolves cached container host when called multiple times', () => {
      // Arrange
      const getEnvVarStub = sinon.stub(helpers, 'getEnvVar');
      getEnvVarStub.withArgs('MDS_FN_CONTAINER_HOST').returns('1.2.3.4:5678');

      // Act
      return logic.getContainerHost().then((result1) =>
        logic.getContainerHost().then((result2) => {
          // Assert
          chai.expect(result1).to.equal('1.2.3.4:5678/');
          chai.expect(result2).to.equal('1.2.3.4:5678/');
          chai.expect(getEnvVarStub.callCount).to.equal(1);
        }),
      );
    });

    it('resolves ip address of host name when dns name used in place of IP address', () => {
      // Arrange
      const getEnvVarStub = sinon.stub(helpers, 'getEnvVar');
      getEnvVarStub.withArgs('MDS_FN_CONTAINER_HOST').returns('someHost:5678');
      sinon
        .stub(dns, 'lookup')
        .callsFake((hn, cb) => cb(undefined, { address: '1.2.3.4' }));

      // Act
      return logic.getContainerHost().then((result1) => {
        // Assert
        chai.expect(result1).to.equal('1.2.3.4:5678/');
      });
    });

    it('resolves the environment variable when ip lookup fails', async () => {
      // Arrange
      const getEnvVarStub = sinon.stub(helpers, 'getEnvVar');
      getEnvVarStub.withArgs('MDS_FN_CONTAINER_HOST').returns('someHost:5678');
      sinon
        .stub(dns, 'lookup')
        .callsFake((hn, cb) => cb(new Error('test error')));

      // Act
      const result = await logic.getContainerHost();

      // Assert
      chai.expect(result).to.equal('someHost:5678/');
    });
  });

  describe('createFunction', () => {
    it('When function does not exist creates the function record in the data store', async () => {
      // Arrange
      const funcColStub = {
        findOne: sinon.stub().resolves(),
        insertOne: sinon.stub().resolves(),
      };
      sinon.stub(repo, 'getDatabase').resolves({
        close: () => Promise.resolve(),
        getCollection: () => funcColStub,
      });
      const now = new Date();
      sinon.useFakeTimers(now);

      // Act
      const result = await logic.createFunction({
        name: 'testFunction',
        accountId: 'test-123',
      });

      // Assert
      chai.expect(result).to.exist;
      chai.expect(result.exists).to.be.equal(false);
      chai.expect(result.id).to.be.string;
      chai.expect(funcColStub.findOne.callCount).to.be.equal(1);
      chai.expect(funcColStub.findOne.getCall(0).args).to.deep.equal([
        {
          name: 'testFunction',
          accountId: 'test-123',
          deletedOn: {
            $exists: false,
          },
        },
      ]);
      chai.expect(funcColStub.insertOne.callCount).to.be.equal(1);
      chai.expect(funcColStub.insertOne.getCall(0).args).to.deep.equal([
        {
          name: 'testFunction',
          accountId: 'test-123',
          id: result.id,
          created: now.toISOString(),
          maxProcesses: 3,
          nextVersion: 1,
        },
        {
          writeConcern: {
            j: true,
            w: 'majority',
            wtimeout: 30000,
          },
        },
      ]);
    });

    it('When the function exists returns message stating function already exists', async () => {
      // Arrange
      const funcId = 'testFunctionId';
      const funcColStub = {
        findOne: sinon
          .stub()
          .withArgs(sinon.match({ id: funcId }))
          .resolves({}),
        insertOne: sinon.stub().resolves(),
      };
      sinon.stub(repo, 'getDatabase').resolves({
        close: () => Promise.resolve(),
        getCollection: () => funcColStub,
      });
      const now = new Date();
      sinon.useFakeTimers(now);

      // Act
      const result = await logic.createFunction({
        name: 'testFunction',
        accountId: 'test-123',
      });

      // Assert
      chai.expect(result).to.exist;
      chai.expect(result.exists).to.be.equal(true);
      chai.expect(result.id).to.be.undefined;
      chai.expect(funcColStub.findOne.callCount).to.be.equal(1);
      chai.expect(funcColStub.findOne.getCall(0).args).to.deep.equal([
        {
          name: 'testFunction',
          accountId: 'test-123',
          deletedOn: {
            $exists: false,
          },
        },
      ]);
      chai.expect(funcColStub.insertOne.callCount).to.be.equal(0);
    });
  });

  describe('listFunction', () => {
    it('Lists all available functions', async () => {
      // Arrange
      const now = new Date();
      sinon.useFakeTimers(now);
      const expectedResults = [
        {
          accountId: 'acct1',
          id: '1',
          created: now.toISOString(),
          name: 'acct1-1',
        },
        {
          accountId: 'acct2',
          id: '2',
          created: now.toISOString(),
          name: 'acct2-2',
        },
      ];
      const funcColStub = {
        find: sinon.stub().returns({
          toArray: () => expectedResults,
        }),
      };
      sinon.stub(repo, 'getDatabase').resolves({
        close: () => Promise.resolve(),
        getCollection: () => funcColStub,
      });

      // Act
      const result = await logic.listFunctions();

      // Assert
      chai.expect(result).to.exist;
      chai.expect(result).to.deep.equal(expectedResults);
      chai.expect(funcColStub.find.callCount).to.be.equal(1);
      chai.expect(funcColStub.find.getCall(0).args).to.deep.equal([
        {
          deletedOn: {
            $exists: false,
          },
        },
      ]);
    });
  });

  describe('executeFunction', () => {
    it('When function exists calls function and returns result', async () => {
      // Arrange
      const expectedResult = {
        foo: 'bar',
      };
      const funcId = 'testFunctionId';
      const funcColStub = {
        findOne: sinon
          .stub()
          .withArgs(sinon.match({ id: funcId, deletedOn: { $exists: false } }))
          .resolves({
            fullTagName: 'blah/someTag',
            tagVersion: '1',
          }),
      };
      const identityFake = {
        impersonateUser: sinon.stub().resolves({
          token: 'fakeImpersonationToken',
        }),
      };
      sinon.stub(repo, 'getDatabase').resolves({
        close: () => Promise.resolve(),
        getCollection: () => funcColStub,
      });
      sinon.stub(containerManager, 'readyFunctionContainerForImage').resolves({
        ip: '127.0.0.1',
        handle: 'containerHandle',
      });
      sinon.stub(containerManager, 'releaseFunctionContainer').resolves();
      sinon.stub(grpcClient, 'invoke').resolves(expectedResult);
      sinon.stub(mdsSdk, 'getIdentityServiceClient').resolves(identityFake);
      sinon.stub(jwt, 'decode').returns({
        userId: 'impersonatedUser',
      });

      // Act
      const result = await logic.executeFunction(
        funcId,
        JSON.stringify({ baz: 1 }),
      );

      // Assert
      chai.expect(result).to.deep.equal(expectedResult);
      chai
        .expect(containerManager.readyFunctionContainerForImage.callCount)
        .to.be.equal(1);
      chai
        .expect(containerManager.readyFunctionContainerForImage.getCall(0).args)
        .to.deep.equal(['blah/someTag', '1']);
      chai
        .expect(containerManager.releaseFunctionContainer.callCount)
        .to.be.equal(1);
      chai
        .expect(containerManager.releaseFunctionContainer.getCall(0).args)
        .to.deep.equal(['containerHandle']);
      chai.expect(grpcClient.invoke.callCount).to.be.equal(1);
      chai.expect(grpcClient.invoke.getCall(0).args).to.deep.equal([
        {
          hostIp: '127.0.0.1',
          payload: JSON.stringify({ baz: 1 }),
          userId: 'impersonatedUser',
          userToken: 'fakeImpersonationToken',
        },
      ]);
    });

    it('When function call errors with retry-able error retries and returns result', async () => {
      // Arrange
      const expectedResult = {
        foo: 'bar',
      };
      const funcId = 'testFunctionId';
      const funcColStub = {
        findOne: sinon
          .stub()
          .withArgs(sinon.match({ id: funcId, deletedOn: { $exists: false } }))
          .resolves({
            fullTagName: 'blah/someTag',
            tagVersion: '1',
          }),
      };
      const identityFake = {
        impersonateUser: sinon.stub().resolves({
          token: 'fakeImpersonationToken',
        }),
      };
      sinon.stub(repo, 'getDatabase').resolves({
        close: () => Promise.resolve(),
        getCollection: () => funcColStub,
      });
      sinon.stub(containerManager, 'readyFunctionContainerForImage').resolves({
        ip: '127.0.0.1',
        handle: 'containerHandle',
      });
      sinon.stub(containerManager, 'releaseFunctionContainer').resolves();
      sinon
        .stub(grpcClient, 'invoke')
        .onFirstCall()
        .rejects(new Error('Could not connect to provided IP'))
        .onSecondCall()
        .resolves(expectedResult);
      sinon.stub(mdsSdk, 'getIdentityServiceClient').resolves(identityFake);
      sinon.stub(jwt, 'decode').returns({
        userId: 'impersonatedUser',
      });

      // Act
      const result = await logic.executeFunction(
        funcId,
        JSON.stringify({ baz: 1 }),
      );

      // Assert
      chai.expect(result).to.deep.equal(expectedResult);
      chai
        .expect(containerManager.readyFunctionContainerForImage.callCount)
        .to.be.equal(2);
      chai
        .expect(containerManager.releaseFunctionContainer.callCount)
        .to.be.equal(2);
      chai.expect(grpcClient.invoke.callCount).to.be.equal(2);
      for (let i = 0; i < 2; i += 1) {
        chai
          .expect(
            containerManager.readyFunctionContainerForImage.getCall(i).args,
          )
          .to.deep.equal(['blah/someTag', '1']);
        chai
          .expect(containerManager.releaseFunctionContainer.getCall(i).args)
          .to.deep.equal(['containerHandle']);
        chai.expect(grpcClient.invoke.getCall(i).args).to.deep.equal([
          {
            hostIp: '127.0.0.1',
            payload: JSON.stringify({ baz: 1 }),
            userId: 'impersonatedUser',
            userToken: 'fakeImpersonationToken',
          },
        ]);
      }
    });

    it('When function does not exist raises error', async () => {
      // Arrange
      const expectedResult = {
        foo: 'bar',
      };
      const funcId = 'testFunctionId';
      const funcColStub = {
        findOne: sinon
          .stub()
          .withArgs(sinon.match({ id: funcId, deletedOn: { $exists: false } }))
          .resolves(),
      };
      sinon.stub(repo, 'getDatabase').resolves({
        close: () => Promise.resolve(),
        getCollection: () => funcColStub,
      });
      sinon.stub(containerManager, 'readyFunctionContainerForImage').resolves({
        ip: '127.0.0.1',
        handle: 'containerHandle',
      });
      sinon.stub(containerManager, 'releaseFunctionContainer').resolves();
      sinon
        .stub(grpcClient, 'invoke')
        .onFirstCall()
        .rejects(new Error('Could not connect to provided IP'))
        .onSecondCall()
        .resolves(expectedResult);

      // Act
      try {
        await logic.executeFunction(funcId, JSON.stringify({ baz: 1 }));
        throw new Error('test should of thrown an error but did not');
      } catch (err) {
        // Assert
        chai.expect(err.message).to.be.equal('function not found');
      }
    });

    it('When function exists but cannot impersonate successfully', async () => {
      // Arrange
      const expectedResult = {
        foo: 'bar',
      };
      const funcId = 'testFunctionId';
      const funcColStub = {
        findOne: sinon
          .stub()
          .withArgs(sinon.match({ id: funcId, deletedOn: { $exists: false } }))
          .resolves({
            fullTagName: 'blah/someTag',
            tagVersion: '1',
          }),
      };
      const identityFake = {
        impersonateUser: sinon.stub().rejects(new Error('FakeError')),
      };
      sinon.stub(repo, 'getDatabase').resolves({
        close: () => Promise.resolve(),
        getCollection: () => funcColStub,
      });
      sinon.stub(containerManager, 'readyFunctionContainerForImage').resolves({
        ip: '127.0.0.1',
        handle: 'containerHandle',
      });
      sinon.stub(containerManager, 'releaseFunctionContainer').resolves();
      sinon.stub(grpcClient, 'invoke').resolves(expectedResult);
      sinon.stub(mdsSdk, 'getIdentityServiceClient').resolves(identityFake);

      // Act
      try {
        await logic.executeFunction(funcId, JSON.stringify({ baz: 1 }));
      } catch (err) {
        // Assert
        chai.expect(err.message).to.equal('FakeError');
        chai
          .expect(containerManager.readyFunctionContainerForImage.callCount)
          .to.be.equal(1);
        chai
          .expect(
            containerManager.readyFunctionContainerForImage.getCall(0).args,
          )
          .to.deep.equal(['blah/someTag', '1']);
        chai
          .expect(containerManager.releaseFunctionContainer.callCount)
          .to.be.equal(1);
        chai
          .expect(containerManager.releaseFunctionContainer.getCall(0).args)
          .to.deep.equal(['containerHandle']);
        chai.expect(grpcClient.invoke.callCount).to.be.equal(0);
      }
    });
  });

  describe('removeFunction', () => {
    it('When function exists, removes function', async () => {
      // Arrange
      const funcId = 'testFunctionId';
      const funcColStub = {
        findOne: sinon
          .stub()
          .withArgs(sinon.match({ id: funcId, deletedOn: { $exists: false } }))
          .resolves({
            fullTagName: 'blah/someTag',
            tagVersion: '1',
          }),
        updateOne: sinon.stub().resolves(),
      };
      sinon.stub(repo, 'getDatabase').resolves({
        close: () => Promise.resolve(),
        getCollection: () => funcColStub,
      });
      const now = new Date();
      sinon.useFakeTimers(now);

      // Act
      await logic.removeFunction(funcId);

      // Assert
      chai.expect(funcColStub.updateOne.callCount).to.be.equal(1);
      chai.expect(funcColStub.updateOne.getCall(0).args).to.deep.equal([
        { id: funcId },
        { $set: { deletedOn: now.toISOString() } },
        {
          writeConcern: {
            j: true,
            w: 'majority',
            wtimeout: 30000,
          },
        },
      ]);
    });

    it('When function does not exist, throws error', async () => {
      // Arrange
      const funcId = 'testFunctionId';
      const funcColStub = {
        findOne: sinon.stub().resolves(),
        updateOne: sinon.stub().resolves(),
      };
      sinon.stub(repo, 'getDatabase').resolves({
        close: () => Promise.resolve(),
        getCollection: () => funcColStub,
      });

      // Act
      try {
        await logic.removeFunction(funcId);
        throw new Error('test should of thrown an error but did not');
      } catch (err) {
        // Assert
        chai.expect(funcColStub.updateOne.callCount).to.be.equal(0);
        chai.expect(err.message).to.be.equal('function not found');
      }
    });

    it('When error occurs when removing function, the error is logged and re-thrown', async () => {
      // Arrange
      const funcId = 'testFunctionId';
      const expectedError = new Error('test error');
      const funcColStub = {
        findOne: sinon
          .stub()
          .withArgs(sinon.match({ id: funcId, deletedOn: { $exists: false } }))
          .resolves({
            fullTagName: 'blah/someTag',
            tagVersion: '1',
          }),
        updateOne: sinon.stub().rejects(expectedError),
      };
      sinon.stub(repo, 'getDatabase').resolves({
        close: () => Promise.resolve(),
        getCollection: () => funcColStub,
      });
      const fakeLogger = {
        debug: sinon.stub(),
        trace: sinon.stub(),
        warn: sinon.stub(),
      };
      sinon.stub(globals, 'getLogger').returns(fakeLogger);
      const now = new Date();
      sinon.useFakeTimers(now);

      // Act
      try {
        await logic.removeFunction(funcId);
        throw new Error('test should of thrown an error but did not');
      } catch (err) {
        // Assert
        chai.expect(funcColStub.updateOne.callCount).to.be.equal(1);
        chai.expect(funcColStub.updateOne.getCall(0).args).to.deep.equal([
          { id: funcId },
          { $set: { deletedOn: now.toISOString() } },
          {
            writeConcern: {
              j: true,
              w: 'majority',
              wtimeout: 30000,
            },
          },
        ]);
        chai.expect(fakeLogger.warn.callCount).to.be.equal(1);
        chai
          .expect(fakeLogger.warn.getCall(0).args)
          .to.deep.equal([
            { err: expectedError },
            'Error when removing function.',
          ]);
      }
    });
  });
});
