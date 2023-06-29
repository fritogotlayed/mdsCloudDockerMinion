import { delay } from '../../utils';
import * as fs from 'fs';
import * as fsPromises from 'fs/promises';
import * as unzipper from 'unzipper';
import * as shelljs from 'shelljs';
import { SourceRepoImpl } from '../repos/source-repo-impl';
import { BaseLogger } from 'pino';

jest.mock('fs');
const mockFs = jest.mocked(fs);

jest.mock('fs/promises');
const mockFsPromises = jest.mocked(fsPromises);

jest.mock('unzipper');
const mockUnzipper = jest.mocked(unzipper);

jest.mock('shelljs', () => ({
  exec: jest.fn(),
}));
const mockShelljs = jest.mocked(shelljs);

const fakeLogger = {
  trace: jest.fn(),
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  fatal: jest.fn(),
};

describe('source-repo-impl', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  afterAll(() => {
    jest.restoreAllMocks();
  });

  describe('cleanupSource', () => {
    it('Passes through to shell to cleanup directory', async () => {
      // Arrange
      mockShelljs.exec.mockReturnValueOnce(undefined as any);
      const repo = new SourceRepoImpl();

      // Act & Assert
      await expect(repo.cleanupSource('/test/dir')).resolves.not.toThrow();
      expect(mockShelljs.exec).toHaveBeenCalledTimes(1);
      expect(mockShelljs.exec).toHaveBeenCalledWith('rm -rf /test/dir');
    });
  });

  describe('extractSource', () => {
    it('when successful extracts source and returns path to source', async () => {
      // Arrange
      const fakeReadStream = {
        pipe: jest.fn(),
        on: jest.fn(),
      };
      fakeReadStream.pipe.mockReturnValueOnce(fakeReadStream);
      fakeReadStream.on.mockImplementation((event, listener) => {
        if (event === 'close') {
          delay(1)
            .then(() => listener())
            .catch((err) => listener(err));
        }
        return fakeReadStream;
      });
      mockFs.createReadStream.mockReturnValueOnce(
        fakeReadStream as unknown as fs.ReadStream,
      );
      mockFsPromises.unlink.mockResolvedValueOnce(undefined);
      mockFsPromises.mkdtemp.mockResolvedValueOnce('/test/directory');
      mockUnzipper.Extract.mockReturnValue(
        undefined as unknown as unzipper.ParseStream,
      );
      const repo = new SourceRepoImpl({
        logger: fakeLogger as unknown as BaseLogger,
      });

      // Act
      const result = await repo.extractSource('/test/file.zip');

      // Assert
      expect(result).toEqual('/test/directory');
    });

    it('when fs stream errors rejects with error', async () => {
      // Arrange
      const fakeReadStream = {
        pipe: jest.fn(),
        on: jest.fn(),
      };
      fakeReadStream.pipe.mockReturnValueOnce(fakeReadStream);
      fakeReadStream.on.mockImplementation((event, listener) => {
        if (event === 'error') {
          delay(1)
            .then(() => listener(new Error('test error')))
            .catch(() => listener());
        }
        return fakeReadStream;
      });
      mockFs.createReadStream.mockReturnValueOnce(
        fakeReadStream as unknown as fs.ReadStream,
      );
      mockFsPromises.unlink.mockResolvedValueOnce(undefined);
      mockFsPromises.mkdtemp.mockResolvedValueOnce('/test/directory');
      mockUnzipper.Extract.mockReturnValue(
        undefined as unknown as unzipper.ParseStream,
      );
      const repo = new SourceRepoImpl({
        logger: fakeLogger as unknown as BaseLogger,
      });

      // Act & Assert
      await expect(
        repo.extractSource('/test/file.zip'),
      ).rejects.toThrowErrorMatchingInlineSnapshot(`"test error"`);
    });

    it('when error thrown rejects with error', async () => {
      // Arrange
      mockFs.createReadStream.mockImplementationOnce(() => {
        throw new Error('test error');
      });
      mockFsPromises.mkdtemp.mockResolvedValueOnce('/test/directory');
      const repo = new SourceRepoImpl({
        logger: fakeLogger as unknown as BaseLogger,
      });

      // Act & Assert
      await expect(
        repo.extractSource('/test/file.zip'),
      ).rejects.toThrowErrorMatchingInlineSnapshot(`"test error"`);
    });
  });
});
