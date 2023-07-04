import { generateEntryPointBody } from '../entry-point';

describe('entry-point', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  afterAll(() => {
    jest.restoreAllMocks();
  });

  it('generates body for entrypoint file with minimal input', () => {
    // Act
    const result = generateEntryPointBody({
      entryPoint: 'path/to/file:main',
    });

    // Assert
    expect(result).toContain(`const userModule = require('./path/to/file');`);
    expect(result).toContain(
      `const PROTO_PATH = \`$\{__dirname}/containerIO.proto\`;`,
    );
    expect(result).toContain(`const USER_CONTEXT = undefined;`);
    expect(result).toContain(
      `const result = userModule.main(userPayload, userContext);`,
    );
  });

  it('generates body for entrypoint file with user context', () => {
    // Act
    const result = generateEntryPointBody({
      entryPoint: 'path/to/file:main',
      userContext: '{"a":1}',
    });

    // Assert
    expect(result).toContain(`const userModule = require('./path/to/file');`);
    expect(result).toContain(
      `const PROTO_PATH = \`$\{__dirname}/containerIO.proto\`;`,
    );
    expect(result).toContain(`const USER_CONTEXT = {"a":1};`);
    expect(result).toContain(
      `const result = userModule.main(userPayload, userContext);`,
    );
  });
});
