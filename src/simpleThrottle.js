const _ = require('lodash');

const globals = require('./globals');

function SimpleThrottle(maxConcurrent) {
  this.maxConcurrent = maxConcurrent || 3;
  this.throttleData = {};
}

SimpleThrottle.prototype.acquire = async function acquire(key) {
  const current = _.get(this.throttleData, key, 0);

  if (current < this.maxConcurrent) {
    this.throttleData[key] = current + 1;
    return Promise.resolve();
  }

  const delayTime = 50 + Math.random() * 100;
  await globals.delay(delayTime);
  return this.acquire(key);
};

SimpleThrottle.prototype.release = async function release(key) {
  const current = _.get(this.throttleData, key, 0);
  this.throttleData[key] = _.max([current - 1, 0]);
};

module.exports = SimpleThrottle;
