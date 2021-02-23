const jsonschema = require('jsonschema');
const runtimes = require('../runtimes');

const createRequestSchema = {
  id: '/BuildContainerRequest',
  title: 'BuildContainerRequest',
  description: 'Create a container image for the end users code',
  type: 'object',
  properties: {
    runtime: {
      enum: runtimes.SUPPORTED_RUNTIMES,
    },
    entryPoint: {
      type: 'string',
      description: 'The location to invoke user code at',
    },
    functionId: {
      type: 'string',
      description: 'The unique identifier for the account',
    },
    // accountId: {
    //   type: 'string',
    //   description: 'The unique identifier for the account',
    // },
    // key: {
    //   type: 'string',
    //   description: '',
    // },
  },
  required: ['entryPoint', 'runtime', 'functionId'],
  additionalProperties: false,
};

const validate = (data) => {
  const validator = new jsonschema.Validator();
  return validator.validate(data, createRequestSchema);
};

module.exports = {
  validate,
};
