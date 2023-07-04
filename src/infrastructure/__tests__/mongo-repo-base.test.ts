import { MongoRepoBase } from '../repos/mongo-repo-base';
import { MongoClient } from 'mongodb';

class MongoWrapper extends MongoRepoBase {}

jest.mock('mongodb', () => ({
  MongoClient: jest.fn(),
}));

let fakeMongoUrl: string | undefined;
let fakeMongoDatabase: string | undefined;
jest.mock('config', () => {
  const originalConfig = jest.requireActual('config');
  return {
    has: originalConfig.has,
    get: jest.fn((key: string) => {
      if (key === 'mongo.url') return fakeMongoUrl;
      if (key === 'mongo.database') return fakeMongoDatabase;
      return originalConfig.get(key);
    }),
  };
});
const mockMongoClient = jest.mocked(MongoClient);

describe('repo test', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  afterAll(() => {
    jest.restoreAllMocks();
  });

  describe('getDatabase', () => {
    it('using defaults returns proper connection', async () => {
      // Arrange
      const fakeCollection = {};
      const fakeConnection = {
        close: jest.fn(),
        db: jest.fn().mockImplementation(() => ({
          collection: jest.fn().mockReturnValue(fakeCollection),
        })),
      };
      mockMongoClient.connect = jest
        .fn()
        .mockImplementation(() => Promise.resolve(fakeConnection));

      // Act
      const repo = new MongoWrapper();
      const db = await repo.getDatabase();
      const col = db.getCollection('foo');
      await db.close();

      // Assert
      expect(col).toEqual(fakeCollection);
      expect(MongoClient.connect).toHaveBeenCalledTimes(1);
      expect(MongoClient.connect).toHaveBeenCalledWith(
        'mongodb://127.0.0.1:27017',
        {
          useNewUrlParser: true,
          useUnifiedTopology: true,
        },
      );
      expect(fakeConnection.db).toHaveBeenCalledTimes(1);
      expect(fakeConnection.db).toHaveBeenCalledWith('mdsCloudDockerMinion');
      expect(fakeConnection.close).toHaveBeenCalledTimes(1);
    });

    it('using url and defaults returns proper connection', async () => {
      // Arrange
      const fakeCollection = {};
      const fakeConnection = {
        close: jest.fn(),
        db: jest.fn().mockImplementation(() => ({
          collection: jest.fn().mockReturnValue(fakeCollection),
        })),
      };
      mockMongoClient.connect = jest
        .fn()
        .mockImplementation(() => Promise.resolve(fakeConnection));

      // Act
      const repo = new MongoWrapper();
      const db = await repo.getDatabase('some-url');
      const col = db.getCollection('foo');
      await db.close();

      // Assert
      expect(col).toEqual(fakeCollection);
      expect(MongoClient.connect).toHaveBeenCalledTimes(1);
      expect(MongoClient.connect).toHaveBeenCalledWith('some-url', {
        useNewUrlParser: true,
        useUnifiedTopology: true,
      });
      expect(fakeConnection.db).toHaveBeenCalledTimes(1);
      expect(fakeConnection.db).toHaveBeenCalledWith('mdsCloudDockerMinion');
      expect(fakeConnection.close).toHaveBeenCalledTimes(1);
    });
  });

  describe('getMongoUrl', () => {
    it('returns value for config key mongo.url when exists', () => {
      try {
        // Arrange
        fakeMongoUrl = 'some-value';

        // Act
        const repo = new MongoWrapper();
        const val = repo.getMongoUrl();

        // Assert
        expect(val).toBe(fakeMongoUrl);
      } finally {
        fakeMongoUrl = undefined;
      }
    });

    it('returns default value when config key mongo.url does not exist', () => {
      // Act
      const repo = new MongoWrapper();
      const val = repo.getMongoUrl();

      // Assert
      expect(val).toBe('mongodb://127.0.0.1:27017');
    });
  });

  describe('getMongoDbName', () => {
    it('returns value for key mongo.database when exists', () => {
      try {
        // Arrange
        fakeMongoDatabase = 'some-value';

        // Act
        const repo = new MongoWrapper();
        const val = repo.getMongoDbName();

        // Assert
        expect(val).toBe(fakeMongoDatabase);
      } finally {
        fakeMongoDatabase = undefined;
      }
    });

    it('returns default value when key mongo.database does not exist', () => {
      // Act
      const repo = new MongoWrapper();
      const val = repo.getMongoDbName();

      // Assert
      expect(val).toBe('mdsCloudDockerMinion');
    });
  });

  describe('setupIndexes', () => {
    it('creates the expected indexes in the DB', async () => {
      // Arrange
      const expectedExpireAfterSec = 60 * 60 * 24 * 7; // 7 days
      const fakeCollection = {
        createIndex: jest.fn().mockResolvedValue(undefined),
      };
      const fakeConnection = {
        close: jest.fn(),
        db: jest.fn().mockImplementation(() => ({
          collection: jest.fn().mockReturnValue(fakeCollection),
        })),
      };
      mockMongoClient.connect = jest
        .fn()
        .mockImplementation(() => Promise.resolve(fakeConnection));

      // Act
      const repo = new MongoWrapper();
      await repo.setupIndexes();

      // Assert
      expect(fakeCollection.createIndex).toHaveBeenCalledTimes(1);
      expect(fakeCollection.createIndex).toHaveBeenCalledWith(
        { deletedOn: 1 },
        { expireAfterSeconds: expectedExpireAfterSec },
      );
    });
  });
});
