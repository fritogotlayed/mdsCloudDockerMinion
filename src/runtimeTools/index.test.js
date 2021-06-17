const _ = require('lodash');
const chai = require('chai');
const sinon = require('sinon');

const index = require('./index');

describe('src/runtimeTools/index', () => {
  afterEach(() => {
    sinon.restore();
  });

  describe('getRuntimeTools', () => {
    _.forEach([
      ['node', true],
      ['python', true],
      ['unknown', false],
    ], ([language, exists]) => {
      it(`Runtime ${language} expected to ${exists ? 'exist' : 'not exist'}`, () => {
        let tools;
        try {
          tools = index.getRuntimeTools(language);
        } catch (err) {
          if (!err || err.message !== `Runtime "${language}" not understood.`) {
            throw err;
          }
        }
        chai.expect(!!tools).to.equal(exists);
      });
    });
  });
});
