import { merge } from 'lodash';
import { Collection, Document, MongoClient, MongoClientOptions } from 'mongodb';
import config from 'config';

export type MongoDatabaseWrapper = {
  getCollection: (name: string) => Collection<Document>;
  close: () => Promise<void>;
};

// TODO: Make abstract
export abstract class MongoRepoBase {
  getMongoUrl(): string {
    return (
      config.get<string | undefined>('mongo.url') ?? 'mongodb://127.0.0.1:27017'
    );
  }

  getMongoDbName(): string {
    return (
      config.get<string | undefined>('mongo.database') ?? 'mdsCloudDockerMinion'
    );
  }

  async getDatabase(
    url?: string,
    options?: Record<string, unknown>,
  ): Promise<MongoDatabaseWrapper> {
    const defaultOptions = { useNewUrlParser: true, useUnifiedTopology: true };
    const connUrl = url || this.getMongoUrl();
    const opts: MongoClientOptions = merge(
      {},
      defaultOptions,
      options,
    ) as MongoClientOptions;

    const client = await MongoClient.connect(connUrl, opts);
    const db = client.db(this.getMongoDbName());
    return {
      getCollection: (name: string) => db.collection(name),
      close: () => client.close(),
    };
  }

  async setupIndexes(url?: string, options?: Record<string, unknown>) {
    const db = await this.getDatabase(url, options);
    const functionsCol = db.getCollection('functions');
    const oneHour = 60 * 60;
    const twentyFourHours = oneHour * 24;
    const sevenDays = twentyFourHours * 7;

    await functionsCol.createIndex(
      { deletedOn: 1 },
      { expireAfterSeconds: sevenDays },
    );
  }
}
