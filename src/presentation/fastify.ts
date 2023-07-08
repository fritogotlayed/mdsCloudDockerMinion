// import FastifyRequest from 'fastify';
import { IdentityJwt } from './types/identity-jwt';
import { Logic } from '../core/logic';

/**
 * Extensions to the base fastify types.
 */
declare module 'fastify' {
  interface FastifyRequest {
    parsedToken?: IdentityJwt;
    services: {
      logic: Logic;
    };
    // requestorIp?: string;
    // isLocal?: boolean;
  }
}
