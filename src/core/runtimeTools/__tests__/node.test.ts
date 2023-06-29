import * as fsPromises from 'fs/promises';
import { NodeRuntimeTools } from '../node';
import { generateProtobufFiles } from '../templates/node/proto-setup';
import { generateEntryPointBody } from '../templates/node/entry-point';
import { generateDockerfileBody } from '../templates/node/dockerfile';

jest.mock('fs/promises', () => ({
  readdir: jest.fn(),
  readFile: jest.fn(),
  writeFile: jest.fn(),
}));

jest.mock('../../../presentation/logging', () => ({
  getLogger: () => ({
    error: jest.fn(),
  }),
}));

describe('node', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  afterAll(() => {
    jest.restoreAllMocks();
  });

  describe('findEntrypoint', () => {
    it('when directory contains package.json returns directory', async () => {
      // Arrange
      const testDir = '/test/dir';
      (
        jest.spyOn(fsPromises, 'readdir') as unknown as jest.SpyInstance<
          Promise<string[]>
        >
      ).mockImplementation(() => Promise.resolve(['package.json']));
      const tools = new NodeRuntimeTools();

      // Act
      const result = await tools.findEntrypoint(testDir);

      // Assert
      expect(result).toBe(testDir);
    });

    it('when directory is empty error is thrown', async () => {
      // Arrange
      const testDir = '/test/dir';
      (
        jest.spyOn(fsPromises, 'readdir') as unknown as jest.SpyInstance<
          Promise<string[]>
        >
      ).mockImplementation(() => Promise.resolve([]));
      const tools = new NodeRuntimeTools();

      // Act & Assert
      await expect(tools.findEntrypoint(testDir)).rejects.toThrow(
        'Empty directory detected',
      );
    });

    it('when directory does not contain package.json returns best guess', async () => {
      // Arrange
      const testDir = '/test/dir';
      (
        jest.spyOn(fsPromises, 'readdir') as unknown as jest.SpyInstance<
          Promise<string[]>
        >
      ).mockImplementation(() => Promise.resolve(['dir1', 'dir2', 'file1']));
      const tools = new NodeRuntimeTools();

      // Act
      const result = await tools.findEntrypoint(testDir);

      // Assert
      expect(result).toBe(`${testDir}/dir1`);
    });
  });

  describe('prepSourceForContainerBuild', () => {
    it('creates all the expected files in the source directory', async () => {
      // Arrange
      jest.spyOn(fsPromises, 'readFile').mockResolvedValue('{}');
      const spyWriteFile = jest.spyOn(fsPromises, 'writeFile');
      spyWriteFile.mockResolvedValue(undefined);
      const tools = new NodeRuntimeTools();

      // Act
      await tools.prepSourceForContainerBuild('localPath', 'entryPoint');

      // Assert
      expect(spyWriteFile).toHaveBeenCalledTimes(4);
      expect(spyWriteFile).toHaveBeenCalledWith(
        'localPath/package.json',
        JSON.stringify(
          {
            dependencies: {
              '@grpc/grpc-js': '^1.2.6',
              '@grpc/proto-loader': '^0.5.6',
            },
          },
          null,
          2,
        ),
      );
      expect(spyWriteFile).toHaveBeenCalledWith(
        'localPath/mdsEntry.js',
        generateEntryPointBody({
          entryPoint: 'entryPoint',
        }),
      );
      expect(spyWriteFile).toHaveBeenCalledWith(
        'localPath/MdsDockerfile',
        generateDockerfileBody('mdsEntry.js'),
      );

      const protoFiles = generateProtobufFiles();
      const keys = Object.keys(protoFiles);
      for (const key of keys) {
        expect(spyWriteFile).toHaveBeenCalledWith(
          `localPath/${key}`,
          protoFiles[key],
        );
      }
    });

    it('if error occurs logs and rethrows error', async () => {
      // Arrange
      jest
        .spyOn(fsPromises, 'readFile')
        .mockRejectedValue(new Error('test error'));
      const tools = new NodeRuntimeTools();

      // Act
      const task = tools.prepSourceForContainerBuild('localPath', 'entryPoint');

      // Assert
      await expect(task).rejects.toThrowErrorMatchingInlineSnapshot(
        `"test error"`,
      );
    });
  });
});
