const _ = require('lodash');
const { MongoClient } = require('mongodb');

const self = {
  getMongoUrl: (env) => _.get(env, ['MDS_FN_MONGO_URL'], 'mongodb://127.0.0.1:27017'),

  getMongoDbName: (env) => _.get(env, ['MDS_FN_MONGO_DB_NAME'], 'mdsCloudDockerMinion'),

  getDatabase: (url, options) => {
    const defaultOptions = { useNewUrlParser: true, useUnifiedTopology: true };
    const connUrl = url || self.getMongoUrl(process.env);
    const opts = _.merge({}, defaultOptions, options);

    return MongoClient.connect(connUrl, opts).then((client) => {
      const db = client.db(self.getMongoDbName(process.env));
      const wrappedDb = {
        getCollection: (name) => db.collection(name),
        close: () => client.close(),
      };
      return wrappedDb;
    });
  },

  setupIndexes: async (url, options) => {
    const db = await self.getDatabase(url, options);
    const functionsCol = db.getCollection('functions');
    const oneHour = 60 * 60;
    const twentyFourHours = oneHour * 24;
    const sevenDays = twentyFourHours * 7;

    await functionsCol.createIndex({ deletedOn: 1 }, { expireAfterSeconds: sevenDays });
  },
};

module.exports = self;
