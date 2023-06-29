import { SimpleThrottle } from '../simple-throttle';

jest.mock('../../utils', () => {
  const actualDelay = jest.requireActual('../../utils').delay;
  return {
    delay: () => actualDelay(1),
  };
});

const testKey = 'test';

describe('simple-throttle', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  afterAll(() => {
    jest.restoreAllMocks();
  });

  it('Works as expected with default of 3 concurrent operations', async () => {
    // Arrange
    const actualDelay = jest.requireActual('../../utils').delay;
    const simpleThrottle = new SimpleThrottle();
    const data = [];

    // Act
    const setupPromises = [
      simpleThrottle.acquire(testKey).then(() => data.push(1)),
      simpleThrottle.acquire(testKey).then(() => data.push(2)),
      simpleThrottle.acquire(testKey).then(() => data.push(3)),
      simpleThrottle.acquire(testKey).then(() => data.push(4)),
    ];
    await actualDelay(10);
    data.push('release');
    await simpleThrottle.release(testKey);
    await actualDelay(10);
    await Promise.all([
      ...setupPromises,
      simpleThrottle.release(testKey),
      simpleThrottle.release(testKey),
      simpleThrottle.release(testKey),
    ]);

    // Assert
    expect(data).toEqual([1, 2, 3, 'release', 4]);
  });

  it('Works as expected with supplied concurrent operations', async () => {
    // Arrange
    const actualDelay = jest.requireActual('../../utils').delay;
    const simpleThrottle = new SimpleThrottle(2);
    const data = [];

    // Act
    const setupPromises = [
      simpleThrottle.acquire(testKey).then(() => data.push(1)),
      simpleThrottle.acquire(testKey).then(() => data.push(2)),
      simpleThrottle.acquire(testKey).then(() => data.push(3)),
    ];
    await actualDelay(10);
    data.push('release');
    await simpleThrottle.release(testKey);
    await actualDelay(10);
    await Promise.all([
      ...setupPromises,
      simpleThrottle.release(testKey),
      simpleThrottle.release(testKey),
    ]);

    // Assert
    expect(data).toEqual([1, 2, 'release', 3]);
  });
});
