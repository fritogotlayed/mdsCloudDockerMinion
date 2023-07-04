import {
  CreateFunctionArgs,
  FunctionMetadata,
  FunctionsRepo,
  UpdateFunctionArgs,
} from '../../core/interfaces/functions-repo';
import { MongoDatabaseWrapper, MongoRepoBase } from './mongo-repo-base';
import { BaseLogger } from 'pino';
import { CommandOperationOptions } from 'mongodb';
import { generateRandomString } from '../../utils';
import { DateTime } from 'luxon';

const options: CommandOperationOptions = {
  writeConcern: {
    w: 'majority',
    j: true,
    wtimeout: 30000, // milliseconds
  },
};

export class FunctionsRepoMongo extends MongoRepoBase implements FunctionsRepo {
  #logger: BaseLogger | undefined;
  constructor({ logger }: { logger?: BaseLogger } = {}) {
    super();
    this.#logger = logger;
  }

  async createFunction(args: CreateFunctionArgs): Promise<string | null> {
    const { name, accountId } = args;
    const db = await this.getDatabase();
    try {
      const col = db.getCollection('functions');
      const existingCheck = await col.findOne({
        name,
        accountId,
        deletedOn: { $exists: false },
      });

      if (existingCheck) {
        return null;
      }

      const newId = generateRandomString(32);
      const newItem: FunctionMetadata = {
        id: newId,
        accountId: `${accountId}`,
        name,
        created: DateTime.utc().toString(),
        nextVersion: 1,
        maxProcesses: 3,
      };

      await col.insertOne(newItem, options);
      return newId;
    } finally {
      await db.close();
    }
  }

  async listFunctions(): Promise<FunctionMetadata[]> {
    const db = await this.getDatabase();
    try {
      const col = db.getCollection('functions');
      const meta = await col
        .find({
          deletedOn: { $exists: false },
        })
        .toArray();

      this.#logger?.debug(
        { meta },
        'Function metadata fetch for list complete',
      );

      return meta.map<FunctionMetadata>((e) => ({
        id: e.id,
        accountId: e.accountId,
        name: e.name,
        created: e.created,
        version: e.version,
        maxProcesses: e.maxProcesses,
        nextVersion: e.nextVersion,
      }));
    } catch (err) {
      this.#logger?.warn({ err }, 'Error occurred when listing functions');
      throw err;
    } finally {
      await db.close();
    }
  }

  async getFunctionInfo(id: string): Promise<FunctionMetadata> {
    const db = await this.getDatabase();
    try {
      const col = db.getCollection('functions');
      const metadata = await col.findOne<FunctionMetadata>({
        id,
        deletedOn: { $exists: false },
      });
      this.#logger?.debug(
        { metadata },
        'Function metadata fetch for build complete',
      );

      if (!metadata) {
        throw new Error(`Could not find function ${id}`);
      }

      return metadata;
    } finally {
      await db.close();
    }
  }

  async updateFunctionInfo(args: UpdateFunctionArgs): Promise<void> {
    const { id, incrementVersion, ...updatePayload } = args;
    const db = await this.getDatabase();
    try {
      const col = db.getCollection('functions');
      const metadata = await col.findOne<FunctionMetadata>({
        id,
        deletedOn: { $exists: false },
      });
      this.#logger?.debug(
        { metadata },
        'Function metadata fetch for build complete',
      );

      if (!metadata) {
        throw new Error(`Could not find function ${id}`);
      }

      const payload: {
        $set: Record<string, unknown>;
        $inc?: Record<string, unknown>;
      } = {
        $set: {
          ...updatePayload,
        },
      };

      if (incrementVersion) {
        payload.$inc = { nextVersion: 1 };
      }

      await col.updateOne({ id }, payload, options);
    } finally {
      await db.close();
    }
  }

  async removeFunction(id: string) {
    let db: MongoDatabaseWrapper | undefined;
    try {
      db = await this.getDatabase();
      const col = db.getCollection('functions');
      const metadata = await col.findOne({
        id,
        deletedOn: { $exists: false },
      });

      if (!metadata) {
        throw new Error('function not found');
      }

      this.#logger?.debug(
        { metadata },
        'Function metadata fetch for removal complete',
      );

      const payload = {
        $set: {
          deletedOn: new Date().toISOString(),
        },
      };

      await col.updateOne({ id }, payload, options);
    } catch (err) {
      this.#logger?.warn({ err }, 'Error when removing function');
    } finally {
      await db?.close();
    }
  }
}
