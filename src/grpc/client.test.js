/* eslint-disable no-unused-expressions */
const _ = require('lodash');
const chai = require('chai');
const sinon = require('sinon');

const protoLoader = require('@grpc/proto-loader');
// const grpc = require('@grpc/grpc-js');

const globals = require('../globals');
// const helpers = require('../helpers');
const client = require('./client');

describe(__filename, () => {
  afterEach(() => {
    sinon.restore();
  });

  describe('loadDefinition', () => {
    it('loads universal mdsCloud definition', async () => {
      // Arrange
      const loadSpy = sinon.spy(protoLoader, 'load');

      // Act
      const result = await client.loadDefinition();

      // Assert
      chai.expect(result).to.not.be.undefined;
      chai.expect(result.Interchange).to.not.be.undefined;
      chai.expect(loadSpy.callCount).to.be.equal(1);
      chai
        .expect(loadSpy.getCall(0).args[0])
        .to.equal(`${__dirname}/protos/containerIO.proto`);
    });
  });

  describe('convertPayloadToString', () => {
    _.each(
      [
        ['test data', 'test data'],
        [123, '123'],
        [true, 'true'],
        [{ a: '1', b: 2 }, '{"a":"1","b":2}'],
      ],
      ([input, expected]) => {
        it(`Converts ${typeof input} appropriately`, () => {
          // Act
          const result = client.convertPayloadToString(input);

          // Assert
          chai.expect(result).to.be.equal(expected);
        });
      },
    );
  });

  describe('convertUserResponseToObject', () => {
    it('when null provided returns null', () => {
      // Act
      const result = client.convertUserResponseToObject(null);

      // Assert
      chai.expect(result).to.be.null;
    });

    it('when undefined provided returns null', () => {
      // Act
      const result = client.convertUserResponseToObject(undefined);

      // Assert
      chai.expect(result).to.be.null;
    });

    it('when a json string provided an matching object is returned', () => {
      // Arrange
      const expected = {
        a: '1',
        b: 2,
        c: {
          d: 'woo',
        },
      };

      // Act
      const result = client.convertUserResponseToObject(
        JSON.stringify(expected),
      );

      // Assert
      chai.expect(result).to.deep.equal(expected);
    });
  });

  describe('createClientFromGrpcDefinition', () => {
    it('Creates a client when provided a valid gRPC definition', async () => {
      // Arrange
      const def = await client.loadDefinition();

      // Act
      const result = client.createClientFromGrpcDefinition(def, '127.0.0.1');

      // Assert
      chai.expect(result).to.not.be.undefined;
      chai.expect(result.process).to.not.be.undefined;
      chai.expect(typeof result.process).to.be.equal('function');
    });
  });

  describe('invoke', () => {
    it('when target yields result, returns result', async () => {
      // Arrange
      const expectedResult = {
        foo: 'bar',
        baz: 1,
      };
      const mockClient = {
        process: (payload, cb) => {
          cb(undefined, { userResponse: JSON.stringify(expectedResult) });
        },
      };
      sinon.stub(client, 'createClientFromGrpcDefinition').returns(mockClient);

      // Act
      const result = await client.invoke({ payload: 'foo' });

      // Assert
      chai.expect(result).to.deep.equal(expectedResult);
    });

    it('when endpoint not yet ready, retries and returns result', async () => {
      // Arrange
      let errorRaised = false;
      const expectedResult = {
        foo: 'bar',
        baz: 1,
      };
      const mockClient = {
        process: (payload, cb) => {
          if (!errorRaised) {
            errorRaised = true;
            cb(new Error('14 UNAVAILABLE'), undefined);
          } else {
            cb(undefined, { userResponse: JSON.stringify(expectedResult) });
          }
        },
      };
      sinon.stub(client, 'createClientFromGrpcDefinition').returns(mockClient);

      // Act
      const result = await client.invoke({ payload: 'foo' });

      // Assert
      chai.expect(result).to.deep.equal(expectedResult);
    });

    it('when endpoint never ready, throws specific error', async () => {
      // Arrange
      const mockClient = {
        process: (payload, cb) => {
          cb(new Error('14 UNAVAILABLE'), undefined);
        },
      };
      sinon.stub(client, 'createClientFromGrpcDefinition').returns(mockClient);
      sinon.stub(globals, 'delay').resolves();

      // Act
      try {
        await client.invoke({ payload: 'foo' });
        throw new Error('Test passed when it should have failed.');
      } catch (err) {
        // Assert
        chai
          .expect(err.message)
          .to.be.equal('Could not connect to provided IP');
      }
    });

    it('when client raises unexpected error that error is re-thrown', async () => {
      // Arrange
      const mockClient = {
        process: (payload, cb) => {
          cb(new Error('OMG!'), undefined);
        },
      };
      sinon.stub(client, 'createClientFromGrpcDefinition').returns(mockClient);

      // Act
      try {
        await client.invoke({ payload: 'foo' });
        throw new Error('Test passed when it should have failed.');
      } catch (err) {
        // Assert
        chai.expect(err.message).to.be.equal('OMG!');
      }
    });
  });
});
