import { FastifyInstance } from 'fastify';
import { GetHealthResponse, GetHealthResponseSchema } from '../schemas';

export function healthCheckController(app: FastifyInstance) {
  app.get<{
    Body: any;
  }>(
    '/',
    {
      schema: {
        description: 'Health check',
        tags: ['X-HIDDEN'],
        response: {
          200: GetHealthResponseSchema,
        },
      },
    },
    (request, response) => {
      response.status(200);
      response.send({ status: 'OK' } as GetHealthResponse);
    },
  );

  // TODO: Not sure why but this is needed so that tests do not time out.
  // From local testing this appears to work fine without this. Unit tests fail
  // with a timeout error without this.
  return Promise.resolve();
}
