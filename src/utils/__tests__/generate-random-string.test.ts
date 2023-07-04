import { generateRandomString } from '../generate-random-string';

describe('generateRandomString', () => {
  it('Generates a random string conforming to the length supplied', () => {
    // Arrange
    const length = 20;

    // Act
    const result = generateRandomString(length);
    const result2 = generateRandomString(length);

    // Assert
    expect(result).toBeTruthy();
    expect(result.length).toBe(length);
    expect(typeof result).toBe('string');
    expect(result).not.toBe(result2);
  });

  it('Generates a empty string when length is 0', () => {
    // Act
    const result = generateRandomString(0);

    // Assert
    expect(result).toBe('');
  });

  it('Generates a empty string when length is a negative number', () => {
    // Act
    const result = generateRandomString(-12);

    // Assert
    expect(result).toBe('');
  });
});
