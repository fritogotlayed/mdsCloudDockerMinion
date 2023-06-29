import { delay } from '../delay';

describe('delay', () => {
  it('Delays for the provided duration', async () => {
    // Arrange
    const start = new Date().getTime();

    // Act
    await delay(10);

    // Assert
    const done = new Date().getTime();
    const drift = done - start;

    // Allow for a bit of drift due to test concurrency
    expect(drift).toBeGreaterThanOrEqual(0);
    expect(drift).toBeLessThanOrEqual(1000);
  });
});
