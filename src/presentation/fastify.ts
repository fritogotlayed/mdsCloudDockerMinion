// import FastifyRequest from 'fastify';
import { IdentityJwt } from './types/identity-jwt';

/**
 * Extensions to the base fastify types.
 */
declare module 'fastify' {
  interface FastifyRequest {
    parsedToken?: IdentityJwt;
    // requestorIp?: string;
    // isLocal?: boolean;
  }
}
