import * as protoLoader from '@grpc/proto-loader';
import { GrpcClient } from '../client';
import { MdsClient, MdsProtoDefinition } from '../types/package';
import { credentials, ServiceError } from '@grpc/grpc-js';

jest.mock('../../../presentation/logging', () => ({
  getLogger: () => ({
    debug: jest.fn(),
  }),
}));

jest.mock('../../../utils', () => ({
  delay: jest.fn().mockResolvedValue(undefined),
}));

describe('client', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  afterAll(() => {
    jest.restoreAllMocks();
  });

  describe('loadDefinition', () => {
    it('loads universal mdsCloud definition', async () => {
      // Arrange
      const spyProtoLoad = jest.spyOn(protoLoader, 'load');
      const client = new GrpcClient();

      // Act
      const result = await client.loadDefinition();

      // Assert
      expect(result).toBeTruthy();
      expect(result.Interchange).toBeTruthy();
      expect(spyProtoLoad).toHaveBeenCalledTimes(1);
      expect(spyProtoLoad).toHaveBeenCalledWith(
        expect.stringContaining('containerIO.proto'),
        {
          keepCase: true,
          longs: String,
          enums: String,
          defaults: true,
          oneofs: true,
        },
      );
    });
  });

  describe('convertPayloadToString', () => {
    [
      ['test data', 'test data'],
      [123, '123'],
      [true, 'true'],
      [{ a: '1', b: 2 }, '{"a":"1","b":2}'],
    ].forEach(([input, expected]) => {
      it(`Converts ${typeof input} appropriately`, () => {
        // Arrange
        const client = new GrpcClient();

        // Act
        const result = client.convertPayloadToString(input);

        // Assert
        expect(result).toEqual(expected);
      });
    });
  });

  describe('convertUserResponseToObject', () => {
    [
      [null, null],
      [undefined, null],
      ['{"a":"1","b":2}', { a: '1', b: 2 }],
    ].forEach(([input, expected]) => {
      it(`Converts ${typeof input} appropriately`, () => {
        // Arrange
        const client = new GrpcClient();

        // Act
        const result = client.convertUserResponseToObject(input as string);

        // Assert
        expect(result).toEqual(expected);
      });
    });
  });

  describe('createClientFromGrpcDefinition', () => {
    it('creates a client when provided a valid gRPC definition', () => {
      // Arrange
      const client = new GrpcClient();
      const def = {
        Interchange: jest.fn(),
      };

      // Act
      const result = client.createClientFromGrpcDefinition(
        def as unknown as MdsProtoDefinition,
        '127.0.0.1',
      );

      // Assert
      expect(result).toBeTruthy();
      expect(def.Interchange).toHaveBeenCalledTimes(1);
      expect(def.Interchange).toHaveBeenCalledWith(
        '127.0.0.1:50051',
        credentials.createInsecure(),
      );
    });
  });

  describe('invoke', () => {
    it('when target yeilds result returns result', async () => {
      // Arrange
      const client = new GrpcClient();
      const expectedResult = {
        foo: 'bar',
        baz: 1,
      };
      jest
        .spyOn(client, 'createClientFromGrpcDefinition')
        .mockImplementation(() => {
          return {
            process: (payload, cb) => {
              cb(null, { userResponse: JSON.stringify(expectedResult) });
            },
          } as MdsClient;
        });

      // Act
      const result = await client.invoke({
        payload: 'foo',
        hostIp: '127.0.0.1',
        userId: 'test',
        userToken: 'testToken',
      });

      // Assert
      expect(result).toEqual(expectedResult);
    });

    it('when endpoint not yet ready, retries and returns result', async () => {
      // Arrange
      let errorRaised = false;
      const client = new GrpcClient();
      const expectedResult = {
        foo: 'bar',
        baz: 1,
      };
      jest
        .spyOn(client, 'createClientFromGrpcDefinition')
        .mockImplementation(() => {
          return {
            process: (payload, cb) => {
              if (errorRaised) {
                cb(null, { userResponse: JSON.stringify(expectedResult) });
              } else {
                errorRaised = true;
                cb(new Error('14 UNAVAILABLE') as ServiceError);
              }
            },
          } as MdsClient;
        });

      // Act
      const result = await client.invoke({
        payload: 'foo',
        hostIp: '127.0.0.1',
        userId: 'test',
        userToken: 'testToken',
      });

      // Assert
      expect(result).toEqual(expectedResult);
      expect(errorRaised).toBeTruthy();
    });

    it('when endpoint never ready throws specific error', async () => {
      // Arrange
      const client = new GrpcClient();
      jest
        .spyOn(client, 'createClientFromGrpcDefinition')
        .mockImplementation(() => {
          return {
            process: (payload, cb) => {
              cb(new Error('14 UNAVAILABLE') as ServiceError);
            },
          } as MdsClient;
        });

      // Act & Assert
      await expect(
        client.invoke({
          payload: 'foo',
          hostIp: '127.0.0.1',
          userId: 'test',
          userToken: 'testToken',
        }),
      ).rejects.toThrowErrorMatchingInlineSnapshot(
        `"Could not connect to provided IP"`,
      );
    });

    it('when client raises unexpected error that error is re-thrown', async () => {
      // Arrange
      const client = new GrpcClient();
      jest
        .spyOn(client, 'createClientFromGrpcDefinition')
        .mockImplementation(() => {
          return {
            process: (payload, cb) => {
              cb(new Error('OMG!') as ServiceError);
            },
          } as MdsClient;
        });

      // Act & Assert
      await expect(
        client.invoke({
          payload: 'foo',
          hostIp: '127.0.0.1',
          userId: 'test',
          userToken: 'testToken',
        }),
      ).rejects.toThrowErrorMatchingInlineSnapshot(`"OMG!"`);
    });
  });
});
