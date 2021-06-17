const express = require('express');
const os = require('os');
const path = require('path');
const luxon = require('luxon');

const handlerHelpers = require('../handler-helpers');
const createValidator = require('../../validators/create');
const buildContainerValidator = require('../../validators/buildContainer');
const globals = require('../../globals');
const helpers = require('../../helpers');
const logic = require('../../logic');

const router = express.Router();
const logger = globals.getLogger();

const createFunction = async (request, response) => {
  const { body } = request;

  const validationResult = createValidator.validate(body);
  if (!validationResult.valid) {
    return handlerHelpers.sendResponse(response, 400, JSON.stringify(validationResult.errors));
  }

  try {
    const createResult = await logic.createFunction({
      name: body.name,
      accountId: body.accountId,
    });

    if (createResult.exists) {
      return handlerHelpers.sendResponse(response, 409);
    }

    const respBody = {
      name: body.name,
      id: createResult.id,
    };
    return handlerHelpers.sendResponse(response, 201, JSON.stringify(respBody));
  } catch (err) {
    const referenceNumber = `${globals.generateRandomString(32)}-${luxon.DateTime.utc().toMillis()}`;
    const msg = {
      status: 'Failed',
      referenceNumber,
    };
    logger.warn({ err, referenceNumber }, 'Function failed to create');
    return handlerHelpers.sendResponse(response, 500, JSON.stringify(msg));
  }
};

const listFunctions = async (request, response) => {
  try {
    const result = await logic.listFunctions();
    logger.trace('success response returned');
    return handlerHelpers.sendResponse(response, 200, result);
  } catch (err) {
    logger.error(err, 'Error occurred while attempting to execute function');
    const referenceNumber = `${globals.generateRandomString(32)}-${luxon.DateTime.utc().toMillis()}`;
    const msg = {
      status: 'Failed',
      referenceNumber,
    };
    return handlerHelpers.sendResponse(response, 500, JSON.stringify(msg));
  }
};

const buildContainerHandler = async (request, response) => {
  const { body, files } = request;

  const validationResult = buildContainerValidator.validate(body);
  if (!validationResult.valid) {
    const respBody = JSON.stringify(validationResult.errors);
    return handlerHelpers.sendResponse(response, 400, respBody);
  }

  if (!files || !files.sourceArchive) {
    const respBody = JSON.stringify([{ message: 'sourceArchive missing from payload' }]);
    return handlerHelpers.sendResponse(response, 400, respBody);
  }

  let localFilePath;
  try {
    const distinctFile = `${globals.generateRandomString(8)}-${files.sourceArchive.name}`;
    localFilePath = `${os.tmpdir()}${path.sep}${distinctFile}`;
    await helpers.saveRequestFile(files.sourceArchive, localFilePath);

    // TODO: Figure out what metadata to move to DB from request body
    await logic.buildFunction({
      functionId: body.functionId,
      localFilePath,
      runtime: body.runtime,
      entryPoint: body.entryPoint,
    });

    const msg = {
      status: 'success',
    };
    return handlerHelpers.sendResponse(response, 200, JSON.stringify(msg));
  } catch (err) {
    const referenceNumber = `${globals.generateRandomString(32)}-${luxon.DateTime.utc().toMillis()}`;
    const msg = {
      status: 'Failed',
      referenceNumber,
    };
    logger.warn({ err, referenceNumber }, 'Function failed to build');
    return handlerHelpers.sendResponse(response, 400, JSON.stringify(msg));
  } finally {
    if (localFilePath) logic.cleanupDirectory(localFilePath);
  }
};

const executeContainerHandler = async (request, response) => {
  const { body, params } = request;
  const {
    functionId,
  } = params;
  try {
    const result = await logic.executeFunction(functionId, body);
    logger.trace('success response returned');
    return handlerHelpers.sendResponse(response, 200, result);
  } catch (err) {
    logger.trace('error response returned');
    if (err.message === 'function not found') {
      return handlerHelpers.sendResponse(response, 404);
    }
    logger.error(err, 'Error occurred while attempting to execute function');
    return handlerHelpers.sendResponse(response, 500);
  }
};

const removeFunction = async (request, response) => {
  const { params } = request;
  const { functionId } = params;

  try {
    const result = await logic.removeFunction(functionId);
    logger.trace('success response returned');
    return handlerHelpers.sendResponse(response, 200, result);
  } catch (err) {
    logger.trace('error response returned');
    if (err.message === 'function not found') {
      return handlerHelpers.sendResponse(response, 404);
    }
    logger.error(err, 'Error occurred while attempting to execute function');
    return handlerHelpers.sendResponse(response, 500);
  }
};

router.post('/createFunction',
  handlerHelpers.validateToken(logger),
  handlerHelpers.ensureRequestFromSystem({ logger }),
  createFunction);

router.get('/all',
  handlerHelpers.validateToken(logger),
  handlerHelpers.ensureRequestFromSystem({ logger }),
  listFunctions);

// Get specific function details ??

// Modify Function Settings ??

router.post('/buildFunction',
  handlerHelpers.validateToken(logger),
  handlerHelpers.ensureRequestFromSystem({ logger }),
  buildContainerHandler);

router.post('/executeFunction/:functionId',
  handlerHelpers.validateToken(logger),
  handlerHelpers.ensureRequestFromSystem({ logger }),
  executeContainerHandler);

// Delete Function
router.delete('/:functionId',
  handlerHelpers.validateToken(logger),
  handlerHelpers.ensureRequestFromSystem({ logger }),
  removeFunction);

module.exports = router;
