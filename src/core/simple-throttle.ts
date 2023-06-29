import { get, max } from 'lodash';
import { delay } from '../utils';

export class SimpleThrottle {
  // NOTE: we keep the acquire and release methods returning promises
  // in the event that we move to a distributed throttle in the future

  readonly maxConcurrent: number;
  readonly throttleData: Record<string, number | undefined> = {};

  constructor(maxConcurrent?: number) {
    this.maxConcurrent = maxConcurrent ?? 3;
  }

  async acquire(key: string): Promise<void> {
    const current = get(this.throttleData, key, 0);

    if (current < this.maxConcurrent) {
      this.throttleData[key] = current + 1;
      return;
    }

    const delayTime = 50 + Math.random() * 100;
    await delay(delayTime);
    await this.acquire(key);
  }

  release(key: string): Promise<void> {
    const current = get(this.throttleData, key, 0);
    this.throttleData[key] = max([current - 1, 0]);
    return Promise.resolve();
  }
}
