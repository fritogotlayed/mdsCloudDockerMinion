import { generateProtobufFiles } from '../proto-setup';

describe('proto-setup', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  afterAll(() => {
    jest.restoreAllMocks();
  });

  it('generates fileName to file content mapping', () => {
    // Act
    const result = generateProtobufFiles();

    // Assert
    expect(result).toEqual({
      'containerIO.proto': expect.any(Buffer),
    });
  });
});
