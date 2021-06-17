/* eslint-disable no-unused-expressions */
const supertest = require('supertest');
const chai = require('chai');
const sinon = require('sinon');
const jwt = require('jsonwebtoken');

const handlerHelpers = require('../handler-helpers');
const src = require('../..');
const logic = require('../../logic');

describe(__filename, () => {
  let app;

  before(() => {
    app = src.buildApp();
  });

  beforeEach(() => {
    sinon.stub(handlerHelpers, 'getIssuer').returns('testIssuer');
    sinon.stub(handlerHelpers, 'getAppPublicSignature').resolves('publicSignature');
    sinon.stub(jwt, 'verify').returns({
      payload: {
        iss: 'testIssuer',
        accountId: '1',
      },
    });
  });

  afterEach(() => {
    sinon.restore();
  });

  describe('createFunction', () => {
    it('when valid request, responds with 201 and created details', () => {
      // Arrange
      sinon.stub(logic, 'createFunction').resolves({
        exists: false,
        id: 'newTestId',
      });

      // Act / Assert
      return supertest(app)
        .post('/v1/createFunction')
        .set('token', 'testToken')
        .send({
          name: 'testName',
          accountId: 'testAccountId',
        })
        .expect('content-type', /application\/json/)
        .expect(201)
        .then((resp) => {
          const body = JSON.parse(resp.text);

          chai.expect(body).to.eql({
            name: 'testName',
            id: 'newTestId',
          });
        });
    });

    it('when function exists for account, returns 409', () => {
      // Arrange
      sinon.stub(logic, 'createFunction').resolves({
        exists: true,
        // id: 'newTestId',
      });

      // Act / Assert
      return supertest(app)
        .post('/v1/createFunction')
        .set('token', 'testToken')
        .send({
          name: 'testName',
          accountId: 'testAccountId',
        })
        .expect('content-type', /application\/json/)
        .expect(409);
    });

    it('when invalid body, returns 400', () => {
      // Arrange
      sinon.stub(logic, 'createFunction').resolves({
        exists: true,
        // id: 'newTestId',
      });

      // Act / Assert
      return supertest(app)
        .post('/v1/createFunction')
        .set('token', 'testToken')
        .send({})
        .expect('content-type', /application\/json/)
        .expect(400)
        .then((resp) => {
          const body = JSON.parse(resp.text);

          delete body.ts; // removed due to no value added and difficulty to test

          chai.expect(body).to.eql([
            {
              argument: 'name',
              instance: {},
              message: 'requires property "name"',
              name: 'required',
              path: [],
              property: 'instance',
              schema: '/CreateRequest',
              stack: 'instance requires property "name"',
            },
            {
              argument: 'accountId',
              instance: {},
              message: 'requires property "accountId"',
              name: 'required',
              path: [],
              property: 'instance',
              schema: '/CreateRequest',
              stack: 'instance requires property "accountId"',
            },
          ]);
        });
    });

    it('when unhandled error is thrown, 500 returned with reference number', () => {
      // Arrange
      sinon.stub(logic, 'createFunction').throws(new Error('test error'));

      // Act / Assert
      return supertest(app)
        .post('/v1/createFunction')
        .set('token', 'testToken')
        .send({
          name: 'testName',
          accountId: 'testAccountId',
        })
        .expect('content-type', /application\/json/)
        .expect(500)
        .then((resp) => {
          const body = JSON.parse(resp.text);

          chai.expect(body.referenceNumber).to.not.be.undefined;
          chai.expect(body.referenceNumber).to.not.be.null;
          chai.expect(body.status).to.be.equal('Failed');
        });
    });
  });

  describe('listFunctions', () => {
    it('when valid request, responds with 200 and details', () => {
      // Arrange
      const expected = [{
        id: 'func1',
        name: 'Function 1',
      }, {
        id: 'func2',
        name: 'Function 2',
      }];

      sinon.stub(logic, 'listFunctions').resolves(expected);

      // Act / Assert
      return supertest(app)
        .get('/v1/all')
        .set('token', 'testToken')
        .expect('content-type', /application\/json/)
        .expect(200)
        .then((resp) => {
          const body = JSON.parse(resp.text);

          chai.expect(body).to.deep.equal(expected);
        });
    });

    it('when unhandled error is throw, 500 returned with reference number', () => {
      // Arrange
      sinon.stub(logic, 'listFunctions').throws(new Error('test error'));

      // Act / Assert
      return supertest(app)
        .get('/v1/all')
        .set('token', 'testToken')
        .expect('content-type', /application\/json/)
        .expect(500)
        .then((resp) => {
          const body = JSON.parse(resp.text);

          chai.expect(body.referenceNumber).to.not.be.undefined;
          chai.expect(body.referenceNumber).to.not.be.null;
          chai.expect(body.status).to.be.equal('Failed');
        });
    });
  });

  describe('buildFunction', () => {
    it('when valid request, responds with 200 and status', () => {
      // Arrange
      sinon.stub(logic, 'buildFunction').resolves({
        exists: false,
        id: 'newTestId',
      });

      // Act / Assert
      return supertest(app)
        .post('/v1/buildFunction')
        .set('token', 'testToken')
        .attach('sourceArchive', 'README.md')
        .field('runtime', 'node')
        .field('entryPoint', '/foo/bar:baz')
        .field('functionId', 'testFunctionId')
        .expect('content-type', /application\/json/)
        .expect(200)
        .then((resp) => {
          const body = JSON.parse(resp.text);

          chai.expect(body).to.eql({
            status: 'success',
          });
        });
    });

    it('when file missing from request, responds with 200 and status', () => {
      // Arrange
      sinon.stub(logic, 'buildFunction').resolves({
        exists: false,
        id: 'newTestId',
      });

      // Act / Assert
      return supertest(app)
        .post('/v1/buildFunction')
        .set('token', 'testToken')
        .send({
          runtime: 'node',
          entryPoint: '/foo/bar:baz',
          functionId: 'testFunctionId',
        })
        .expect('content-type', /application\/json/)
        .expect(400)
        .then((resp) => {
          const body = JSON.parse(resp.text);

          chai.expect(body).to.eql([{
            message: 'sourceArchive missing from payload',
          }]);
        });
    });

    it('when invalid body, returns 400', () => {
      // Arrange
      sinon.stub(logic, 'buildFunction').resolves({
        exists: true,
        // id: 'newTestId',
      });

      // Act / Assert
      return supertest(app)
        .post('/v1/buildFunction')
        .set('token', 'testToken')
        .send({})
        .expect('content-type', /application\/json/)
        .expect(400)
        .then((resp) => {
          const body = JSON.parse(resp.text);

          delete body.ts; // removed due to no value added and difficulty to test

          chai.expect(body).to.eql([
            {
              argument: 'entryPoint',
              instance: {},
              message: 'requires property "entryPoint"',
              name: 'required',
              path: [],
              property: 'instance',
              schema: '/BuildContainerRequest',
              stack: 'instance requires property "entryPoint"',
            },
            {
              argument: 'runtime',
              instance: {},
              message: 'requires property "runtime"',
              name: 'required',
              path: [],
              property: 'instance',
              schema: '/BuildContainerRequest',
              stack: 'instance requires property "runtime"',
            },
            {
              argument: 'functionId',
              instance: {},
              message: 'requires property "functionId"',
              name: 'required',
              path: [],
              property: 'instance',
              schema: '/BuildContainerRequest',
              stack: 'instance requires property "functionId"',
            },
          ]);
        });
    });

    it('when unhandled error is thrown, 400 returned with reference number', () => {
      // Arrange
      sinon.stub(logic, 'buildFunction').throws(new Error('test error'));

      // Act / Assert
      return supertest(app)
        .post('/v1/buildFunction')
        .set('token', 'testToken')
        .attach('sourceArchive', 'README.md')
        .field('runtime', 'node')
        .field('entryPoint', '/foo/bar:baz')
        .field('functionId', 'testFunctionId')
        .expect('content-type', /application\/json/)
        .expect(400)
        .then((resp) => {
          const body = JSON.parse(resp.text);

          chai.expect(body.referenceNumber).to.not.be.undefined;
          chai.expect(body.referenceNumber).to.not.be.null;
          chai.expect(body.status).to.be.equal('Failed');
        });
    });
  });

  describe('executeFunction', () => {
    it('when valid request, responds with 200 and function output', () => {
      // Arrange
      sinon.stub(logic, 'executeFunction').resolves({
        sample: 'response',
      });

      // Act / Assert
      return supertest(app)
        .post('/v1/executeFunction/abc123')
        .set('token', 'testToken')
        .send({
          testBody: 'input',
        })
        .expect('content-type', /application\/json/)
        .expect(200)
        .then((resp) => {
          const body = JSON.parse(resp.text);

          chai.expect(logic.executeFunction.callCount).to.be.equal(1);
          chai.expect(logic.executeFunction.getCall(0).args).to.deep.equal([
            'abc123',
            { testBody: 'input' },
          ]);
          chai.expect(body).to.eql({
            sample: 'response',
          });
        });
    });

    it('when function does not exist, responds with 404', () => {
      // Arrange
      sinon.stub(logic, 'executeFunction').rejects(new Error('function not found'));

      // Act / Assert
      return supertest(app)
        .post('/v1/executeFunction/abc123')
        .set('token', 'testToken')
        .send({
          testBody: 'input',
        })
        .expect('content-type', /application\/json/)
        .expect(404)
        .then(() => {
          chai.expect(logic.executeFunction.callCount).to.be.equal(1);
          chai.expect(logic.executeFunction.getCall(0).args).to.deep.equal([
            'abc123',
            { testBody: 'input' },
          ]);
        });
    });

    it('when function errors, responds with 500', () => {
      // Arrange
      sinon.stub(logic, 'executeFunction').rejects(new Error('test error'));

      // Act / Assert
      return supertest(app)
        .post('/v1/executeFunction/abc123')
        .set('token', 'testToken')
        .send({
          testBody: 'input',
        })
        .expect('content-type', /application\/json/)
        .expect(500)
        .then(() => {
          chai.expect(logic.executeFunction.callCount).to.be.equal(1);
          chai.expect(logic.executeFunction.getCall(0).args).to.deep.equal([
            'abc123',
            { testBody: 'input' },
          ]);
        });
    });
  });

  describe('removeFunction', () => {
    it('when valid request, responds with 200 and function output', () => {
      // Arrange
      sinon.stub(logic, 'removeFunction').resolves();

      // Act / Assert
      return supertest(app)
        .delete('/v1/abc123')
        .set('token', 'testToken')
        .send({
          testBody: 'input',
        })
        .expect('content-type', /application\/json/)
        .expect(200)
        .then(() => {
          chai.expect(logic.removeFunction.callCount).to.be.equal(1);
          chai.expect(logic.removeFunction.getCall(0).args).to.deep.equal([
            'abc123',
          ]);
        });
    });

    it('when function does not exist, responds with 404', () => {
      // Arrange
      sinon.stub(logic, 'removeFunction').rejects(new Error('function not found'));

      // Act / Assert
      return supertest(app)
        .delete('/v1/abc123')
        .set('token', 'testToken')
        .send({
          testBody: 'input',
        })
        .expect('content-type', /application\/json/)
        .expect(404)
        .then(() => {
          chai.expect(logic.removeFunction.callCount).to.be.equal(1);
          chai.expect(logic.removeFunction.getCall(0).args).to.deep.equal([
            'abc123',
          ]);
        });
    });

    it('when function errors, responds with 500', () => {
      // Arrange
      sinon.stub(logic, 'removeFunction').rejects(new Error('test error'));

      // Act / Assert
      return supertest(app)
        .delete('/v1/abc123')
        .set('token', 'testToken')
        .send({
          testBody: 'input',
        })
        .expect('content-type', /application\/json/)
        .expect(500)
        .then(() => {
          chai.expect(logic.removeFunction.callCount).to.be.equal(1);
          chai.expect(logic.removeFunction.getCall(0).args).to.deep.equal([
            'abc123',
          ]);
        });
    });
  });
});
