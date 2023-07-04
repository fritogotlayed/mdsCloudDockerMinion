import { randomBytes } from 'crypto';

export function generateRandomString(length: number): string {
  if (length < 1) {
    return '';
  }

  // When converting bytes to hex you get two characters for every byte. So
  // we divide the requested length in half rounding up to save a bit of
  // memory / processing.
  const size = Math.floor(length / 2.0 + 0.5);
  const str = randomBytes(size).toString('hex');
  return str.substring(0, length);
}
