import { EnsureRequestFromSystem } from '../ensure-request-from-system';
import { FastifyReply, FastifyRequest } from 'fastify';
import { IdentityJwt } from '../../types/identity-jwt';

jest.mock('../../logging', () => ({
  getLogger: () => ({
    debug: jest.fn(),
  }),
}));

describe('ensure-request-from-system', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  afterAll(() => {
    jest.restoreAllMocks();
  });

  it('for valid token does not throw', async () => {
    // Arrange
    const request: {
      parsedToken: IdentityJwt | undefined;
      headers: Record<string, string>;
    } = {
      parsedToken: {
        header: { alg: 'RS512' },
        signature: '',
        payload: {
          accountId: '1',
          userId: '',
          friendlyName: '',
        },
      },
      headers: { token: 'testToken' },
    };
    const reply: {
      status: () => void;
      header: (key: string, value: string) => void;
      send: (arg: unknown) => void;
    } = {
      status: jest.fn(),
      header: jest.fn(),
      send: jest.fn(),
    };

    // Act & Assert
    await expect(
      EnsureRequestFromSystem(
        request as FastifyRequest,
        reply as unknown as FastifyReply,
      ),
    ).resolves.not.toThrow();
  });

  it('for invalid token does throw', async () => {
    // Arrange
    const request: {
      parsedToken: IdentityJwt | undefined;
      headers: Record<string, string>;
    } = {
      parsedToken: {
        header: { alg: 'RS512' },
        signature: '',
        payload: {
          accountId: '11',
          userId: '',
          friendlyName: '',
        },
      },
      headers: { token: 'testToken' },
    };
    const reply: {
      status: () => void;
      header: (key: string, value: string) => void;
      send: (arg: unknown) => void;
    } = {
      status: jest.fn(),
      header: jest.fn(),
      send: jest.fn(),
    };

    // Act & Assert
    await expect(
      EnsureRequestFromSystem(
        request as FastifyRequest,
        reply as unknown as FastifyReply,
      ),
    ).rejects.toThrowErrorMatchingInlineSnapshot(
      `"Insufficient privilege for request"`,
    );
  });

  it('for missing token does throw', async () => {
    // Arrange
    const request: {
      parsedToken: IdentityJwt | undefined;
      headers: Record<string, string>;
    } = {
      parsedToken: undefined,
      headers: { token: 'testToken' },
    };
    const reply: {
      status: () => void;
      header: (key: string, value: string) => void;
      send: (arg: unknown) => void;
    } = {
      status: jest.fn(),
      header: jest.fn(),
      send: jest.fn(),
    };

    // Act & Assert
    await expect(
      EnsureRequestFromSystem(
        request as FastifyRequest,
        reply as unknown as FastifyReply,
      ),
    ).rejects.toThrowErrorMatchingInlineSnapshot(
      `"Insufficient privilege for request"`,
    );
  });
});
