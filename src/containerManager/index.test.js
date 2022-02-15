/* eslint-disable no-unused-expressions */
const chai = require('chai');
const sinon = require('sinon');
const luxon = require('luxon');

const globals = require('../globals');
const helpers = require('../helpers');
const containerManager = require('./index');

describe(__filename, () => {
  afterEach(() => {
    sinon.restore();
  });

  it('default export contains stub metadata and simple throttle', () => {
    chai.expect(containerManager.containerMetadata).to.deep.equal({});
    chai.expect(containerManager.simpleThrottle).to.not.be.undefined;
    chai.expect(containerManager.simpleThrottle).to.not.be.null;
  });

  describe('findContainersMatchingImage', () => {
    it('returns filtered list when only image name provided', async () => {
      // Arrange
      const containersStub = {
        listContainers: sinon
          .stub()
          .resolves([{ Image: 'imageA' }, { Image: 'imageB' }, { Image: 'C' }]),
      };
      sinon.stub(globals, 'getDockerInterface').returns(containersStub);

      // Act
      const result = await containerManager.findContainersMatchingImage(
        'image',
      );

      // Assert
      chai
        .expect(result)
        .to.deep.equal([{ Image: 'imageA' }, { Image: 'imageB' }]);
      chai.expect(containersStub.listContainers.getCall(0).args).to.deep.equal([
        {
          all: true,
        },
      ]);
    });

    it('returns filtered only running list when only image name provided', async () => {
      // Arrange
      const containersStub = {
        listContainers: sinon
          .stub()
          .resolves([{ Image: 'imageA' }, { Image: 'imageB' }, { Image: 'C' }]),
      };
      sinon.stub(globals, 'getDockerInterface').returns(containersStub);

      // Act
      const result = await containerManager.findContainersMatchingImage(
        'image',
        { onlyRunning: true },
      );

      // Assert
      chai
        .expect(result)
        .to.deep.equal([{ Image: 'imageA' }, { Image: 'imageB' }]);
      chai.expect(containersStub.listContainers.getCall(0).args).to.deep.equal([
        {
          all: false,
        },
      ]);
    });
  });

  describe('startMonitor', () => {
    it('when monitor not running starts functioning monitor', () => {
      // Arrange
      const clock = sinon.useFakeTimers();
      sinon.stub(containerManager, 'handleOrphanedContainers').resolves();

      // Act & Assert
      chai.expect(containerManager.monitorHandle).to.be.equal(undefined);
      containerManager.startMonitor();
      chai.expect(containerManager.monitorHandle).to.not.be.undefined;
      clock.tick(15 * 1000);
      chai
        .expect(containerManager.handleOrphanedContainers.callCount)
        .to.be.equal(1);
    });

    it('when monitor running does nothing', () => {
      // Arrange
      const clock = sinon.useFakeTimers();
      sinon.stub(containerManager, 'handleOrphanedContainers').resolves();
      containerManager.monitorHandle = { id: 1234 };

      // Act & Assert
      try {
        chai.expect(containerManager.monitorHandle).to.deep.equal({ id: 1234 });
        containerManager.startMonitor();
        chai.expect(containerManager.monitorHandle.id).to.be.equal(1234);
        clock.tick(15 * 1000);
        chai
          .expect(containerManager.handleOrphanedContainers.callCount)
          .to.be.equal(0);
      } finally {
        containerManager.monitorHandle = undefined;
      }
    });
  });

  describe('stopMonitor', () => {
    it('when monitor not running monitor handle is empty after', () => {
      // Act & Assert
      chai.expect(containerManager.monitorHandle).to.be.equal(undefined);
      containerManager.stopMonitor();
      chai.expect(containerManager.monitorHandle).to.be.equal(undefined);
    });

    it('when monitor running stops and clears monitor handle', () => {
      // Arrange
      containerManager.monitorHandle = { id: 1234 };

      // Act & Assert
      try {
        chai.expect(containerManager.monitorHandle).to.deep.equal({ id: 1234 });
        containerManager.stopMonitor();
        chai.expect(containerManager.monitorHandle).to.be.equal(undefined);
      } finally {
        containerManager.monitorHandle = undefined;
      }
    });
  });

  describe('safeStopContainer', () => {
    it('when container is running should stop', async () => {
      // Arrange
      const containerStub = {
        stop: sinon.stub().resolves(),
      };

      // Act
      await containerManager.safeStopContainer(containerStub);

      // Assert
      chai.expect(containerStub.stop.callCount).to.equal(1);
    });

    it('when container is stopped should stop', async () => {
      // Arrange
      const containerStub = {
        stop: sinon.stub().rejects(new Error('container already stopped')),
      };

      // Act
      await containerManager.safeStopContainer(containerStub);

      // Assert
      chai.expect(containerStub.stop.callCount).to.equal(1);
    });

    it('when container stop errors should throw error', async () => {
      // Arrange
      const containerStub = {
        stop: sinon.stub().rejects(new Error('test error')),
      };

      // Act
      try {
        await containerManager.safeStopContainer(containerStub);
        throw new Error('Test passed when it should have failed.');
      } catch (err) {
        // Assert
        chai.expect(err.message).to.equal('test error');
      }
    });
  });

  describe('safeStartContainer', () => {
    it('when container is stopped should start', async () => {
      // Arrange
      const containerStub = {
        start: sinon.stub().resolves(),
      };

      // Act
      await containerManager.safeStartContainer(containerStub);

      // Assert
      chai.expect(containerStub.start.callCount).to.equal(1);
    });

    it('when container is stopped should stop', async () => {
      // Arrange
      const containerStub = {
        start: sinon.stub().rejects(new Error('container already started')),
      };

      // Act
      await containerManager.safeStartContainer(containerStub);

      // Assert
      chai.expect(containerStub.start.callCount).to.equal(1);
    });

    it('when container start errors should throw error', async () => {
      // Arrange
      const containerStub = {
        start: sinon.stub().rejects(new Error('test error')),
      };

      // Act
      try {
        await containerManager.safeStartContainer(containerStub);
        throw new Error('Test passed when it should have failed.');
      } catch (err) {
        // Assert
        chai.expect(err.message).to.equal('test error');
      }
    });
  });

  describe('handleOrphanedContainers', () => {
    it('Removes dead orphaned containers', async () => {
      // Arrange
      const containerStub = {
        inspect: sinon.stub().resolves({
          State: {
            Running: false,
            Paused: false,
            Restarting: false,
            OOMKilled: false,
            Dead: false,
            FinishedAt: '2021-01-01T00:00:00.000000000Z',
          },
        }),
        remove: sinon.stub(),
      };
      const dockerStub = {
        getContainer: sinon.stub().withArgs(['testId']).returns(containerStub),
      };
      sinon.stub(globals, 'getDockerInterface').returns(dockerStub);
      sinon
        .stub(containerManager, 'findContainersMatchingImage')
        .resolves([{ Id: 'testid' }]);

      // Act
      await containerManager.handleOrphanedContainers();

      // Assert
      chai.expect(containerStub.remove.callCount).to.equal(1);
    });

    it('Leaves a recently dead containers', async () => {
      // Arrange
      const containerStub = {
        inspect: sinon.stub().resolves({
          State: {
            Running: false,
            Paused: false,
            Restarting: false,
            OOMKilled: false,
            Dead: false,
            FinishedAt: new Date().toISOString(),
          },
        }),
        remove: sinon.stub(),
      };
      const dockerStub = {
        getContainer: sinon.stub().withArgs(['testId']).returns(containerStub),
      };
      sinon.stub(globals, 'getDockerInterface').returns(dockerStub);
      sinon
        .stub(containerManager, 'findContainersMatchingImage')
        .resolves([{ Id: 'testid' }]);

      // Act
      await containerManager.handleOrphanedContainers();

      // Assert
      chai.expect(containerStub.remove.callCount).to.equal(0);
    });

    it('Stops running orphaned containers', async () => {
      // Arrange
      const containerStub = {
        inspect: sinon.stub().resolves({
          State: {
            Running: true,
            Paused: false,
            Restarting: false,
            OOMKilled: false,
            Dead: false,
            StartedAt: '2021-01-01T00:00:00.000000000Z',
          },
        }),
      };
      const dockerStub = {
        getContainer: sinon.stub().withArgs(['testId']).returns(containerStub),
      };
      sinon.stub(globals, 'getDockerInterface').returns(dockerStub);
      sinon
        .stub(containerManager, 'findContainersMatchingImage')
        .resolves([{ Id: 'testid' }]);
      sinon.stub(containerManager, 'safeStopContainer');

      // Act
      await containerManager.handleOrphanedContainers();

      // Assert
      chai.expect(containerManager.safeStopContainer.callCount).to.equal(1);
    });

    it('Leaves a recently running containers', async () => {
      // Arrange
      const containerStub = {
        inspect: sinon.stub().resolves({
          State: {
            Running: true,
            Paused: false,
            Restarting: false,
            OOMKilled: false,
            Dead: false,
            StartedAt: new Date().toISOString(),
          },
        }),
      };
      const dockerStub = {
        getContainer: sinon.stub().withArgs(['testId']).returns(containerStub),
      };
      sinon.stub(globals, 'getDockerInterface').returns(dockerStub);
      sinon
        .stub(containerManager, 'findContainersMatchingImage')
        .resolves([{ Id: 'testid' }]);
      sinon.stub(containerManager, 'safeStopContainer');

      // Act
      await containerManager.handleOrphanedContainers();

      // Assert
      chai.expect(containerManager.safeStopContainer.callCount).to.equal(0);
    });
  });

  describe('electExistingContainerToReadyForImage', () => {
    it('When no containers available resolves undefined', async () => {
      // Arrange
      sinon.stub(globals, 'getLogger').returns({});
      sinon.stub(containerManager, 'findContainersMatchingImage').resolves([]);

      // Act
      const result =
        await containerManager.electExistingContainerToReadyForImage(
          'test:image',
        );

      // Assert
      chai.expect(result).to.deep.equal(undefined);
    });

    it('When running container available resolves existing container', async () => {
      // Arrange
      const mockContainer = {};
      sinon.stub(globals, 'getLogger').returns({
        trace: sinon.stub(),
      });
      sinon.stub(containerManager, 'findContainersMatchingImage').resolves([
        {
          Id: 'testId',
          State: 'Running',
        },
      ]);
      sinon.stub(globals, 'getDockerInterface').returns({
        getContainer: sinon.stub().withArgs('testId').returns(mockContainer),
      });

      // Act
      const result =
        await containerManager.electExistingContainerToReadyForImage(
          'test:image',
        );

      // Assert
      chai.expect(result).to.equal(mockContainer);
    });

    it('When running and stopped containers available resolves running container', async () => {
      // Arrange
      const mockContainer = {};
      sinon.stub(globals, 'getLogger').returns({
        trace: sinon.stub(),
      });
      sinon.stub(containerManager, 'findContainersMatchingImage').resolves([
        {
          Id: 'testId',
          State: 'Running',
        },
        {
          Id: 'stoppedId',
          State: 'Exited',
        },
      ]);
      sinon.stub(globals, 'getDockerInterface').returns({
        getContainer: sinon.stub().withArgs('testId').returns(mockContainer),
      });

      // Act
      const result =
        await containerManager.electExistingContainerToReadyForImage(
          'test:image',
        );

      // Assert
      chai.expect(result).to.equal(mockContainer);
    });

    it('When stopped container available resolves stopped container', async () => {
      // Arrange
      const now = luxon.DateTime.utc();
      const mockContainer = {
        inspect: sinon.stub().resolves({
          State: {
            FinishedAt: now.minus({ seconds: 10 }),
          },
        }),
      };
      sinon.stub(globals, 'getLogger').returns({
        trace: sinon.stub(),
      });
      sinon.stub(containerManager, 'findContainersMatchingImage').resolves([
        {
          Id: 'testId',
          State: 'Exited',
        },
      ]);
      sinon.stub(containerManager, 'safeStartContainer').resolves();
      sinon.stub(globals, 'getDockerInterface').returns({
        getContainer: sinon.stub().withArgs('testId').returns(mockContainer),
      });

      // Act
      const result =
        await containerManager.electExistingContainerToReadyForImage(
          'test:image',
        );

      // Assert
      chai.expect(result).to.equal(mockContainer);
      chai.expect(containerManager.safeStartContainer.callCount).to.equal(1);
    });

    it('When stopped container not available resolves undefined', async () => {
      // Arrange
      const now = luxon.DateTime.utc();
      const mockContainer = {
        inspect: sinon.stub().resolves({
          State: {
            FinishedAt: now.minus({ seconds: 60 }),
          },
        }),
      };
      sinon.stub(globals, 'getLogger').returns({
        trace: sinon.stub(),
      });
      sinon.stub(containerManager, 'findContainersMatchingImage').resolves([
        {
          Id: 'testId',
          State: 'Exited',
        },
      ]);
      sinon.stub(containerManager, 'safeStartContainer').resolves();
      sinon.stub(globals, 'getDockerInterface').returns({
        getContainer: sinon.stub().withArgs('testId').returns(mockContainer),
      });

      // Act
      const result =
        await containerManager.electExistingContainerToReadyForImage(
          'test:image',
        );

      // Assert
      chai.expect(result).to.equal(undefined);
      chai.expect(containerManager.safeStartContainer.callCount).to.equal(0);
    });
  });

  describe('readyFunctionContainerForImage', () => {
    it('when no existing container starts new container and returns metadata', async () => {
      // Arrange
      const now = luxon.DateTime.utc();
      const mockContainer = {
        id: 'mockContainerId',
        inspect: sinon.stub().resolves({
          State: {
            StartedAt: now.minus({ seconds: 1 }),
          },
          NetworkSettings: {
            IPAddress: 'testIpAddress',
          },
        }),
      };
      sinon.stub(globals, 'getLogger').returns({
        trace: sinon.stub(),
      });
      sinon
        .stub(containerManager, 'electExistingContainerToReadyForImage')
        .resolves();
      sinon.stub(containerManager, 'safeStartContainer').resolves();
      sinon.stub(globals, 'getDockerInterface').returns({
        createContainer: sinon.stub().returns(mockContainer),
      });

      // Act
      const result = await containerManager.readyFunctionContainerForImage(
        'test',
        'image',
      );

      // Assert
      chai.expect(result).to.deep.equal({
        handle: 'mockContainerId',
        ip: 'testIpAddress',
      });
      chai.expect(containerManager.safeStartContainer.callCount).to.equal(1);
    });

    it('when existing container returns metadata', async () => {
      // Arrange
      const now = luxon.DateTime.utc();
      const mockContainer = {
        id: 'mockContainerId',
        inspect: sinon.stub().resolves({
          State: {
            StartedAt: now.minus({ seconds: 1 }),
          },
          NetworkSettings: {
            IPAddress: 'testIpAddress',
          },
        }),
      };
      sinon.stub(globals, 'getLogger').returns({
        trace: sinon.stub(),
      });
      sinon
        .stub(containerManager, 'electExistingContainerToReadyForImage')
        .resolves(mockContainer);
      sinon
        .stub(containerManager, 'safeStartContainer')
        .rejects('Test should not start container');

      // Act
      const result = await containerManager.readyFunctionContainerForImage(
        'test',
        'image',
      );

      // Assert
      chai.expect(result).to.deep.equal({
        handle: 'mockContainerId',
        ip: 'testIpAddress',
      });
      chai.expect(containerManager.safeStartContainer.callCount).to.equal(0);
    });

    it('when existing container and custom network returns metadata', async () => {
      // Arrange
      const now = luxon.DateTime.utc();
      const mockContainer = {
        id: 'mockContainerId',
        inspect: sinon.stub().resolves({
          State: {
            StartedAt: now.minus({ seconds: 1 }),
          },
          NetworkSettings: {
            Networks: {
              CustomNetwork: {
                IPAddress: 'testIpAddress',
              },
            },
          },
        }),
      };
      sinon.stub(globals, 'getLogger').returns({
        trace: sinon.stub(),
      });
      sinon
        .stub(containerManager, 'electExistingContainerToReadyForImage')
        .resolves(mockContainer);
      sinon
        .stub(containerManager, 'safeStartContainer')
        .rejects('Test should not start container');
      sinon
        .stub(helpers, 'getEnvVar')
        .withArgs('MDS_FN_CONTAINER_NETWORK', '')
        .returns('CustomNetwork');

      // Act
      const result = await containerManager.readyFunctionContainerForImage(
        'test',
        'image',
      );

      // Assert
      chai.expect(result).to.deep.equal({
        handle: 'mockContainerId',
        ip: 'testIpAddress',
      });
      chai.expect(containerManager.safeStartContainer.callCount).to.equal(0);
    });
  });
});
