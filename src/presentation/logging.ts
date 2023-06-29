import { FastifyBaseLogger } from 'fastify';

let _logger: FastifyBaseLogger;

export function initialize(logger: FastifyBaseLogger) {
  _logger = logger;
}

export function getLogger(): FastifyBaseLogger {
  return _logger;
}
