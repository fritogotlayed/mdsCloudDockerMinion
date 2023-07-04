import { generateDockerfileBody } from '../dockerfile';

describe('dockerfile', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  afterAll(() => {
    jest.restoreAllMocks();
  });

  it('generates proper dockerfile body when called without argument', () => {
    // Act
    const result = generateDockerfileBody();

    expect(result).toContain('ENTRYPOINT ["node", "func.js"]');
  });

  it('generates proper dockerfile body when called with argument', () => {
    // Act
    const result = generateDockerfileBody('entry.js');

    expect(result).toContain('ENTRYPOINT ["node", "entry.js"]');
  });
});
