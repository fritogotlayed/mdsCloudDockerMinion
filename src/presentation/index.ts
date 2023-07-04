import fastify, { FastifyServerOptions } from 'fastify';
import { fastifyAwilixPlugin, diContainer, Cradle } from '@fastify/awilix';
import multipart from '@fastify/multipart';
import config from 'config';
import { TypeBoxTypeProvider } from '@fastify/type-provider-typebox';
import { rootRouter } from './routes';
import { asFunction, AwilixContainer, Lifetime } from 'awilix';
import { ContainerManager } from '../core/container-manager';
import { Logic } from '../core/logic';
import { initialize } from './logging';
import fastifySwagger from '@fastify/swagger';
import fastifySwaggerUi from '@fastify/swagger-ui';

export function defaultDependencyInjection(
  diContainer: AwilixContainer<Cradle>,
) {
  // We define this outside of the registration functions since the functions
  // execute the first time the item is requested.
  const manager = new ContainerManager();
  manager.startMonitor();

  // Wire things up!
  diContainer.register({
    containerManager: asFunction(
      () => {
        return manager;
      },
      {
        lifetime: Lifetime.SINGLETON,
        dispose: (containerManager) => {
          containerManager.stopMonitor();
        },
      },
    ),
    logic: asFunction(
      ({ containerManager }) => {
        return new Logic({ containerManager });
      },
      {
        lifetime: Lifetime.SCOPED,
      },
    ),
  });
}

export async function buildApp(
  dependencyInjectionOverride?: (diContainer: AwilixContainer<Cradle>) => void,
) {
  // Note: The object coming out of the config is immutable. We spread into
  // a new object so that fastify can modify the object internally as it expects
  // to do.
  const fastifyOptions: FastifyServerOptions = {
    ...config.get<FastifyServerOptions>('fastifyOptions'),
  };
  const server = fastify(fastifyOptions);
  server.withTypeProvider<TypeBoxTypeProvider>();

  if (config.get<boolean>('enableSwagger')) {
    server.register(fastifySwagger, {
      swagger: {
        produces: ['application/json'],
        consumes: ['application/json'],
      },
    });

    server.register(fastifySwaggerUi, {
      uiConfig: {
        docExpansion: 'list',
        deepLinking: false,
      },
    });
  }

  server.register(fastifyAwilixPlugin, {
    disposeOnClose: true,
    disposeOnResponse: true,
  });

  if (dependencyInjectionOverride) {
    dependencyInjectionOverride(diContainer);
  } else {
    defaultDependencyInjection(diContainer);
  }

  await server.register(multipart);
  await server.register(rootRouter);

  // TODO: Should this live here
  initialize(server.log);

  return server;
}
