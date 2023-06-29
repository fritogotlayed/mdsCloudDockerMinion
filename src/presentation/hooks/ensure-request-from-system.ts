import { FastifyReply, FastifyRequest } from 'fastify';
import { getLogger } from '../logging';

export function EnsureRequestFromSystem(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const logger = getLogger();
    const identityJwt = request.parsedToken;
    if (!identityJwt || identityJwt.payload.accountId !== '1') {
      logger.debug(
        { accountId: identityJwt?.payload.accountId },
        'Insufficient privilege for request',
      );
      reply.status(403);
      reply.send();
      return reject(new Error('Insufficient privilege for request'));
    }
    return resolve(undefined);
  });
}
