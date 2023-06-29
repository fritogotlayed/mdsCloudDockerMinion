import { FunctionsRepoMongo } from '../repos/functions-repo-mongo';
import { BaseLogger } from 'pino';
import { MongoDatabaseWrapper } from '../repos/mongo-repo-base';
import { Collection } from 'mongodb';

const fakeLogger = {
  debug: jest.fn(),
  error: jest.fn(),
  fatal: jest.fn(),
  info: jest.fn(),
  trace: jest.fn(),
  warn: jest.fn(),
} as unknown as BaseLogger;

describe('functions-repo-mongo', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  afterAll(() => {
    jest.restoreAllMocks();
  });

  function getTestRepo() {
    const repo = new FunctionsRepoMongo({
      logger: fakeLogger,
    });
    const db = {
      getCollection: jest.fn(),
      close: jest.fn(),
    } as jest.MockedObjectDeep<MongoDatabaseWrapper>;
    repo.getDatabase = jest.fn().mockResolvedValueOnce(db);
    return { repo, db };
  }

  describe('createFunction', () => {
    it('returns new function id when it is created', async () => {
      // Arrange
      const { repo, db } = getTestRepo();
      const fakeCol = {
        findOne: jest.fn().mockResolvedValueOnce(null),
        insertOne: jest.fn().mockResolvedValueOnce(undefined),
      };
      db.getCollection.mockReturnValueOnce(fakeCol as unknown as Collection);

      // Act
      const result = await repo.createFunction({
        name: 'test-name',
        accountId: 'test-account-id',
      });

      // Assert
      expect(result).toEqual(expect.any(String));
      expect(db.close).toHaveBeenCalledTimes(1);
      expect(fakeCol.insertOne).toHaveBeenCalledTimes(1);
    });

    it('returns null when a function exits already', async () => {
      // Arrange
      const { repo, db } = getTestRepo();
      const fakeCol = {
        findOne: jest.fn().mockResolvedValueOnce({}),
        insertOne: jest.fn().mockResolvedValueOnce(undefined),
      };
      db.getCollection.mockReturnValueOnce(fakeCol as unknown as Collection);

      // Act & Assert
      await expect(
        repo.createFunction({
          name: 'test-name',
          accountId: 'test-account-id',
        }),
      ).resolves.not.toThrow();
      expect(db.close).toHaveBeenCalledTimes(1);
      expect(fakeCol.insertOne).toHaveBeenCalledTimes(0);
    });
  });

  describe('listFunctions', () => {
    it('returns function metadata list when successful', async () => {
      // Arrange
      const { repo, db } = getTestRepo();
      db.getCollection.mockReturnValueOnce({
        find: jest.fn().mockReturnValue({
          toArray: jest.fn().mockResolvedValueOnce([
            {
              id: 'test-id',
              accountId: 'test-account-id',
              name: 'test-name',
              created: 'test-created',
              version: 'test-version',
              maxProcesses: 'test-max-processes',
              nextVersion: 'test-next-version',
            },
            {
              id: 'test-id-2',
              accountId: 'test-account-id',
              name: 'test-name',
              created: 'test-created',
              version: 'test-version',
              maxProcesses: 'test-max-processes',
              nextVersion: 'test-next-version',
            },
          ]),
        }),
      } as unknown as Collection);

      // Act
      const result = await repo.listFunctions();

      // Assert
      expect(result).toEqual([
        {
          id: 'test-id',
          accountId: 'test-account-id',
          name: 'test-name',
          created: 'test-created',
          version: 'test-version',
          maxProcesses: 'test-max-processes',
          nextVersion: 'test-next-version',
        },
        {
          id: 'test-id-2',
          accountId: 'test-account-id',
          name: 'test-name',
          created: 'test-created',
          version: 'test-version',
          maxProcesses: 'test-max-processes',
          nextVersion: 'test-next-version',
        },
      ]);
      expect(db.close).toHaveBeenCalledTimes(1);
    });

    it('throws error when function does not exist', async () => {
      // Arrange
      const { repo, db } = getTestRepo();
      db.getCollection.mockReturnValueOnce({
        find: jest.fn().mockReturnValue({
          toArray: jest.fn().mockRejectedValueOnce(new Error('test error')),
        }),
      } as unknown as Collection);

      // Act & Assert
      await expect(
        repo.listFunctions(),
      ).rejects.toThrowErrorMatchingInlineSnapshot(`"test error"`);
      expect(db.close).toHaveBeenCalledTimes(1);
    });
  });

  describe('getFunctionInfo', () => {
    it('returns function metadata when it exists', async () => {
      // Arrange
      const { repo, db } = getTestRepo();
      db.getCollection.mockReturnValueOnce({
        findOne: jest.fn().mockResolvedValueOnce({
          id: 'test-id',
        }),
      } as unknown as Collection);

      // Act
      const result = await repo.getFunctionInfo('test-id');

      // Assert
      expect(result).toEqual({
        id: 'test-id',
      });
      expect(db.close).toHaveBeenCalledTimes(1);
    });

    it('throws error when function does not exist', async () => {
      // Arrange
      const { repo, db } = getTestRepo();
      db.getCollection.mockReturnValueOnce({
        findOne: jest.fn().mockResolvedValueOnce(null),
      } as unknown as Collection);

      // Act & Assert
      await expect(
        repo.getFunctionInfo('test-id'),
      ).rejects.toThrowErrorMatchingInlineSnapshot(
        `"Could not find function test-id"`,
      );
      expect(db.close).toHaveBeenCalledTimes(1);
    });
  });

  describe('updateFunctionInfo', () => {
    describe('updates the function info when it exists', () => {
      let repo: FunctionsRepoMongo;
      let db: jest.MockedObjectDeep<MongoDatabaseWrapper>;
      let fakeCollection: { findOne: jest.Mock; updateOne: jest.Mock };
      beforeEach(() => {
        const pkg = getTestRepo();
        repo = pkg.repo;
        db = pkg.db;

        fakeCollection = {
          findOne: jest.fn().mockResolvedValueOnce({}),
          updateOne: jest.fn().mockResolvedValueOnce({}),
        };
        db.getCollection.mockReturnValueOnce(
          fakeCollection as unknown as Collection,
        );
      });

      it('and incrementValue is true', async () => {
        // Act & Assert
        await expect(
          repo.updateFunctionInfo({
            id: 'test-id',
            incrementVersion: true,
            tagVersion: 'tag-version',
            fullTagName: 'full-tag-name',
            containerHost: 'container-host',
            lastUpdate: 'last-updated-on',
          }),
        ).resolves.not.toThrow();
        expect(db.close).toHaveBeenCalledTimes(1);
        expect(fakeCollection.updateOne).toHaveBeenCalledTimes(1);
        expect(fakeCollection.updateOne).toHaveBeenCalledWith(
          { id: 'test-id' },
          {
            $set: {
              containerHost: 'container-host',
              fullTagName: 'full-tag-name',
              lastUpdate: 'last-updated-on',
              tagVersion: 'tag-version',
            },
            $inc: {
              nextVersion: 1,
            },
          },
          expect.any(Object),
        );
      });

      it('and incrementValue is false', async () => {
        // Act & Assert
        await expect(
          repo.updateFunctionInfo({
            id: 'test-id',
            incrementVersion: false,
            tagVersion: 'tag-version',
            fullTagName: 'full-tag-name',
            containerHost: 'container-host',
            lastUpdate: 'last-updated-on',
          }),
        ).resolves.not.toThrow();
        expect(db.close).toHaveBeenCalledTimes(1);
        expect(fakeCollection.updateOne).toHaveBeenCalledTimes(1);
        expect(fakeCollection.updateOne).toHaveBeenCalledWith(
          { id: 'test-id' },
          {
            $set: {
              containerHost: 'container-host',
              fullTagName: 'full-tag-name',
              lastUpdate: 'last-updated-on',
              tagVersion: 'tag-version',
            },
          },
          expect.any(Object),
        );
      });
    });

    it('throws error when function not found', async () => {
      // Arrange
      const { repo, db } = getTestRepo();
      const fakeCollection = {
        findOne: jest.fn().mockResolvedValueOnce(null),
        updateOne: jest.fn(),
      } as unknown as Collection;
      db.getCollection.mockReturnValueOnce(fakeCollection);

      // Act & Assert
      await expect(
        repo.updateFunctionInfo({
          id: 'test-id',
          incrementVersion: true,
          tagVersion: 'tag-version',
          fullTagName: 'full-tag-name',
          containerHost: 'container-host',
          lastUpdate: 'last-updated-on',
        }),
      ).rejects.toThrowErrorMatchingInlineSnapshot(
        `"Could not find function test-id"`,
      );
      expect(db.close).toHaveBeenCalledTimes(1);
      expect(fakeCollection.updateOne).toHaveBeenCalledTimes(0);
    });
  });

  describe('removeFunction', () => {
    it('removes the function when it exists', async () => {
      // Arrange
      const { repo, db } = getTestRepo();
      const fakeCollection = {
        findOne: jest.fn().mockResolvedValueOnce({}),
        updateOne: jest.fn().mockResolvedValueOnce({}),
      } as unknown as Collection;
      db.getCollection.mockReturnValueOnce(fakeCollection);

      // Act & Assert
      await expect(repo.removeFunction('test-id')).resolves.not.toThrow();
      expect(db.close).toHaveBeenCalledTimes(1);
      expect(fakeCollection.updateOne).toHaveBeenCalledTimes(1);
      expect(fakeCollection.updateOne).toHaveBeenCalledWith(
        { id: 'test-id' },
        {
          $set: {
            deletedOn: expect.any(String),
          },
        },
        expect.any(Object),
      );
    });

    it('logs warning when error occurs during removal', async () => {
      // Arrange
      const { repo, db } = getTestRepo();
      const fakeCollection = {
        findOne: jest.fn().mockResolvedValueOnce({}),
        updateOne: jest.fn().mockRejectedValueOnce(new Error('test error')),
      } as unknown as Collection;
      db.getCollection.mockReturnValueOnce(fakeCollection);

      // Act & Assert
      await expect(repo.removeFunction('test-id')).resolves.not.toThrow();
      expect(db.close).toHaveBeenCalledTimes(1);
      expect(fakeCollection.updateOne).toHaveBeenCalledTimes(1);
      expect(fakeLogger.warn).toHaveBeenCalledTimes(1);
      expect(fakeLogger.warn).toHaveBeenCalledWith(
        expect.any(Object),
        'Error when removing function',
      );
    });

    it('logs warning when function not found', async () => {
      // Arrange
      const { repo, db } = getTestRepo();
      const fakeCollection = {
        findOne: jest.fn().mockResolvedValueOnce(null),
      } as unknown as Collection;
      db.getCollection.mockReturnValueOnce(fakeCollection);

      // Act & Assert
      await expect(repo.removeFunction('test-id')).resolves.not.toThrow();
      expect(db.close).toHaveBeenCalledTimes(1);
      expect(fakeLogger.warn).toHaveBeenCalledTimes(1);
      expect(fakeLogger.warn).toHaveBeenCalledWith(
        expect.any(Object),
        'Error when removing function',
      );
    });
  });
});
