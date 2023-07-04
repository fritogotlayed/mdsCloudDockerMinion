/**
 * @param timeout The amount of time, in milliseconds, to delay.
 */
export function delay(timeout: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, timeout);
  });
}
