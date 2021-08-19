const jsonschema = require('jsonschema');
const runtimes = require('../runtimes');

const schema = {
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
    context: {
      type: 'string',
      description: 'Any contextual data to send to this function upon execution',
    },
  },
  required: ['entryPoint', 'runtime', 'functionId'],
  additionalProperties: false,
};

const validate = (data) => {
  const validator = new jsonschema.Validator();
  return validator.validate(data, schema);
};

module.exports = {
  validate,
};
