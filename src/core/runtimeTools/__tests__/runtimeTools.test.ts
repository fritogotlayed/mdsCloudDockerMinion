import { getRuntimeTools } from '../index';

describe('node', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  afterAll(() => {
    jest.restoreAllMocks();
  });

  describe('getRuntimeTools', () => {
    ['node'].forEach((runtime) => {
      it(`returns runtime tools for ${runtime}`, () => {
        // Act
        const result = getRuntimeTools(runtime);

        // Assert
        expect(result).toBeTruthy();
        expect(result.findEntrypoint).toBeTruthy();
        expect(result.prepSourceForContainerBuild).toBeTruthy();
      });
    });

    it('throws error when runtime tool not understood', () => {
      // Act & Assert
      expect(() =>
        getRuntimeTools('unknown'),
      ).toThrowErrorMatchingInlineSnapshot(
        `"Runtime "unknown" not understood."`,
      );
    });
  });
});
