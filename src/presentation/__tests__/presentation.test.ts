import { ContainerManager } from '../../core/container-manager';
import { buildApp, defaultDependencyInjection } from '../index';
import { diContainer } from '@fastify/awilix';

jest.mock('../../core/container-manager');
const mockContainerManager = jest.mocked(ContainerManager);

describe('presentation', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  afterAll(() => {
    jest.restoreAllMocks();
  });

  describe('defaultDependencyInjection', () => {
    it('registers expected items', async () => {
      try {
        // Arrange
        defaultDependencyInjection(diContainer);

        // Act
        const containerManager = diContainer.resolve('containerManager');
        const logic = diContainer.resolve('logic');

        // Assert
        expect(containerManager).not.toBeNull();
        expect(logic).not.toBeNull();
      } finally {
        await diContainer.dispose();
      }
    });
  });

  describe('buildApp', () => {
    it('using default DI creates and starts container manager', () => {
      // Act
      expect(() => buildApp()).not.toThrow();

      // Assert
      expect(mockContainerManager.prototype.startMonitor).toHaveBeenCalledTimes(
        1,
      );
    });
  });
});
