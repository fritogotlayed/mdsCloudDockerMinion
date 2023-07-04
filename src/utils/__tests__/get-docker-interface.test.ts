import { GetDockerInterface } from '../get-docker-interface';

describe('get-docker-interface', () => {
  it('returns a new docker interface', () => {
    // Act
    const di = GetDockerInterface();

    // Assert
    expect(di).not.toBeFalsy();
  });
});
