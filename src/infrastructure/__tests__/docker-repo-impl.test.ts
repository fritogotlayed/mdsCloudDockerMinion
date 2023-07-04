import { DockerRepoImpl } from '../repos/docker-repo-impl';
import Docker from 'dockerode';

jest.mock('config', () => {
  const originalConfig = jest.requireActual('config');
  return {
    has: originalConfig.has,
    get: jest.fn((key: string) => {
      if (key === 'registry.user') return 'user';
      if (key === 'registry.password') return 'password';
      if (key === 'registry.address') return 'address';
      return originalConfig.get(key);
    }),
  };
});

describe('docker-repo-impl', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  afterAll(() => {
    jest.restoreAllMocks();
  });

  describe('buildImage', () => {
    it('builds proper docker image', async () => {
      // Arrange
      const mockDocker = {
        buildImage: jest.fn().mockResolvedValueOnce(undefined),
        modem: {
          followProgress: jest.fn().mockImplementation((_, cb) => {
            cb(undefined);
          }),
        },
      };
      const repo = new DockerRepoImpl(mockDocker as unknown as Docker);

      // Act & Assert
      await expect(
        repo.buildImage('test-file', { t: 'test-image:test-version' }),
      ).resolves.not.toThrow();
      expect(mockDocker.buildImage).toHaveBeenCalledTimes(1);
      expect(mockDocker.buildImage).toHaveBeenCalledWith('test-file', {
        t: 'test-image:test-version',
      });
    });

    it('throws error when build fails', async () => {
      // Arrange
      const mockDocker = {
        buildImage: jest.fn().mockResolvedValueOnce(undefined),
        modem: {
          followProgress: jest.fn().mockImplementation((_, cb) => {
            cb(new Error('test error'));
          }),
        },
      };
      const repo = new DockerRepoImpl(mockDocker as unknown as Docker);

      // Act & Assert
      await expect(
        repo.buildImage('test-file', { t: 'test-image:test-version' }),
      ).rejects.toThrowErrorMatchingInlineSnapshot(`"test error"`);
      expect(mockDocker.buildImage).toHaveBeenCalledTimes(1);
    });
  });

  describe('pushImage', () => {
    it('pushes proper docker image to registry', async () => {
      // Arrange
      const mockImage = {
        push: jest.fn().mockResolvedValueOnce(undefined),
      };
      const mockDocker = {
        getImage: jest.fn().mockReturnValue(mockImage),
        modem: {
          followProgress: jest.fn().mockImplementation((_, cb) => {
            cb(undefined);
          }),
        },
      };
      const repo = new DockerRepoImpl(mockDocker as unknown as Docker);

      // Act & Assert
      await expect(
        repo.pushImage('test-image', 'test-version'),
      ).resolves.not.toThrow();
      expect(mockDocker.getImage).toHaveBeenCalledTimes(1);
      expect(mockDocker.getImage).toHaveBeenCalledWith(
        'test-image:test-version',
      );
      expect(mockImage.push).toHaveBeenCalledTimes(1);
      expect(mockImage.push).toHaveBeenCalledWith({
        authconfig: {
          password: 'password',
          serveraddress: 'address',
          username: 'user',
        },
      });
    });

    it('throws error when push fails', async () => {
      // Arrange
      const mockImage = {
        push: jest.fn().mockResolvedValueOnce(undefined),
      };
      const mockDocker = {
        getImage: jest.fn().mockReturnValue(mockImage),
        modem: {
          followProgress: jest.fn().mockImplementation((_, cb) => {
            cb(new Error('test error'));
          }),
        },
      };
      const repo = new DockerRepoImpl(mockDocker as unknown as Docker);

      // Act & Assert
      await expect(
        repo.pushImage('test-image', 'test-version'),
      ).rejects.toThrowErrorMatchingInlineSnapshot(`"test error"`);
      expect(mockDocker.getImage).toHaveBeenCalledTimes(1);
      expect(mockImage.push).toHaveBeenCalledTimes(1);
    });
  });

  describe('removeLocalImage', () => {
    it('removes proper docker image from system', async () => {
      // Arrange
      const mockImage = {
        remove: jest.fn(),
      };
      const mockDocker = {
        getImage: jest.fn().mockReturnValue(mockImage),
      };
      const repo = new DockerRepoImpl(mockDocker as unknown as Docker);

      // Act
      await repo.removeLocalImage('test-image', 'test-version');

      // Assert
      expect(mockDocker.getImage).toHaveBeenCalledTimes(1);
      expect(mockDocker.getImage).toHaveBeenCalledWith(
        'test-image:test-version',
      );
      expect(mockImage.remove).toHaveBeenCalledTimes(1);
      expect(mockImage.remove).toHaveBeenCalledWith();
    });
  });

  describe('createContainer', () => {
    it('supplies provided minimal options to service', async () => {
      // Arrange
      const containerStub = { id: 'test-id' };
      const mockDocker = {
        createContainer: jest.fn().mockResolvedValueOnce(containerStub),
      };
      const repo = new DockerRepoImpl(mockDocker as unknown as Docker);

      // Act
      const result = await repo.createContainer({});

      // Assert
      expect(result).toEqual('test-id');
      expect(mockDocker.createContainer).toHaveBeenCalledTimes(1);
      expect(mockDocker.createContainer).toHaveBeenCalledWith({
        Image: undefined,
        name: undefined,
        HostConfig: {
          NetworkMode: 'bridge',
        },
      });
    });

    it('supplies provided options to service', async () => {
      // Arrange
      const containerStub = { id: 'test-id' };
      const mockDocker = {
        createContainer: jest.fn().mockResolvedValueOnce(containerStub),
      };
      const repo = new DockerRepoImpl(mockDocker as unknown as Docker);

      // Act
      const result = await repo.createContainer({
        image: 'test-image',
        name: 'test-name',
        networkMode: 'test-network',
      });

      // Assert
      expect(result).toEqual('test-id');
      expect(mockDocker.createContainer).toHaveBeenCalledTimes(1);
      expect(mockDocker.createContainer).toHaveBeenCalledWith({
        Image: 'test-image',
        name: 'test-name',
        HostConfig: {
          NetworkMode: 'test-network',
        },
      });
    });
  });

  describe('getContainerInfo', () => {
    it('returns the container info for the provided container id', async () => {
      // Arrange
      const inspectData = {};
      const containerStub = {
        id: 'test-id',
        inspect: jest.fn().mockResolvedValueOnce(inspectData),
      };
      const mockDocker = {
        getContainer: jest.fn().mockResolvedValueOnce(containerStub),
      };
      const repo = new DockerRepoImpl(mockDocker as unknown as Docker);

      // Act
      const result = await repo.getContainerInfo('test-id');

      // Assert
      expect(result).toBe(inspectData);
      expect(mockDocker.getContainer).toHaveBeenCalledWith('test-id');
      expect(containerStub.inspect).toHaveBeenCalledTimes(1);
      expect(containerStub.inspect).toHaveBeenCalledWith();
    });
  });

  describe('listContainers', () => {
    it('returns the list of all available containers when called', async () => {
      // Arrange
      const expected: unknown[] = [];
      const mockDocker = {
        listContainers: jest.fn().mockResolvedValueOnce(expected),
      };
      const repo = new DockerRepoImpl(mockDocker as unknown as Docker);

      // Act
      const result = await repo.listContainers();

      // Assert
      expect(result).toBe(expected);
      expect(mockDocker.listContainers).toHaveBeenCalledWith({ all: true });
    });

    it('returns the list of running  containers when called with true', async () => {
      // Arrange
      const expected: unknown[] = [];
      const mockDocker = {
        listContainers: jest.fn().mockResolvedValueOnce(expected),
      };
      const repo = new DockerRepoImpl(mockDocker as unknown as Docker);

      // Act
      const result = await repo.listContainers(true);

      // Assert
      expect(result).toBe(expected);
      expect(mockDocker.listContainers).toHaveBeenCalledWith({ all: false });
    });
  });

  describe('removeContainer', () => {
    it('removes the container for the provided container id', async () => {
      // Arrange
      const containerStub = {
        id: 'test-id',
        remove: jest.fn().mockResolvedValueOnce(undefined),
      };
      const mockDocker = {
        getContainer: jest.fn().mockResolvedValueOnce(containerStub),
      };
      const repo = new DockerRepoImpl(mockDocker as unknown as Docker);

      // Act & Assert
      await expect(repo.removeContainer('test-id')).resolves.not.toThrow();
      expect(mockDocker.getContainer).toHaveBeenCalledWith('test-id');
      expect(containerStub.remove).toHaveBeenCalledTimes(1);
      expect(containerStub.remove).toHaveBeenCalledWith();
    });
  });

  describe('startContainer', () => {
    it('when container is stopped should start', async () => {
      // Arrange
      const containerStub = {
        start: jest.fn().mockResolvedValue(undefined),
      };
      const mockDocker = {
        getContainer: jest.fn().mockResolvedValueOnce(containerStub),
      };
      const repo = new DockerRepoImpl(mockDocker as unknown as Docker);

      // Act
      await repo.startContainer('test');

      // Assert
      expect(containerStub.start).toHaveBeenCalledTimes(1);
    });

    it('when container is running should exit gracefully', async () => {
      // Arrange
      const containerStub = {
        start: jest
          .fn()
          .mockRejectedValueOnce(new Error('container already started')),
      };
      const mockDocker = {
        getContainer: jest.fn().mockResolvedValueOnce(containerStub),
      };
      const repo = new DockerRepoImpl(mockDocker as unknown as Docker);

      // Act
      await repo.startContainer('test');

      // Assert
      expect(containerStub.start).toHaveBeenCalledTimes(1);
    });

    it('when container start errors should throw error', async () => {
      // Arrange
      const containerStub = {
        start: jest.fn().mockRejectedValueOnce(new Error('test error')),
      };
      const mockDocker = {
        getContainer: jest.fn().mockResolvedValueOnce(containerStub),
      };
      const repo = new DockerRepoImpl(mockDocker as unknown as Docker);

      // Act & Assert
      await expect(
        repo.startContainer('test'),
      ).rejects.toThrowErrorMatchingInlineSnapshot(`"test error"`);
    });
  });

  describe('stopContainer', () => {
    it('when container is running should stop', async () => {
      // Arrange
      const containerStub = {
        stop: jest.fn().mockResolvedValue(undefined),
      };
      const mockDocker = {
        getContainer: jest.fn().mockResolvedValueOnce(containerStub),
      };
      const repo = new DockerRepoImpl(mockDocker as unknown as Docker);

      // Act
      await repo.stopContainer('test');

      // Assert
      expect(containerStub.stop).toHaveBeenCalledTimes(1);
    });

    it('when container is stopped should exit gracefully', async () => {
      // Arrange
      const containerStub = {
        stop: jest
          .fn()
          .mockRejectedValueOnce(new Error('container already stopped')),
      };
      const mockDocker = {
        getContainer: jest.fn().mockResolvedValueOnce(containerStub),
      };
      const repo = new DockerRepoImpl(mockDocker as unknown as Docker);

      // Act
      await repo.stopContainer('test');

      // Assert
      expect(containerStub.stop).toHaveBeenCalledTimes(1);
    });

    it('when container stop errors should throw error', async () => {
      // Arrange
      const containerStub = {
        stop: jest.fn().mockRejectedValueOnce(new Error('test error')),
      };
      const mockDocker = {
        getContainer: jest.fn().mockResolvedValueOnce(containerStub),
      };
      const repo = new DockerRepoImpl(mockDocker as unknown as Docker);

      // Act & Assert
      await expect(
        repo.stopContainer('test'),
      ).rejects.toThrowErrorMatchingInlineSnapshot(`"test error"`);
    });
  });
});
