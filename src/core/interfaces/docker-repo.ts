import {
  ContainerInfo,
  ContainerInspectInfo,
  ImageBuildOptions,
} from 'dockerode';

export type CreateContainerOptions = {
  image?: string | undefined;
  name?: string | undefined;
  networkMode?: string | undefined;
};

export interface DockerRepo {
  buildImage: (
    file: string | NodeJS.ReadableStream,
    options: ImageBuildOptions,
  ) => Promise<void>;
  pushImage: (fullTagName: string, version: string | number) => Promise<void>;
  removeLocalImage: (
    fullTagName: string,
    version: string | number,
  ) => Promise<void>;
  listContainers: (onlyRunning?: boolean) => Promise<ContainerInfo[]>;
  getContainerInfo: (id: string) => Promise<ContainerInspectInfo>;
  createContainer: (options: CreateContainerOptions) => Promise<string>;
  removeContainer: (id: string) => Promise<void>;
  stopContainer: (id: string) => Promise<void>;
  startContainer: (id: string) => Promise<void>;
}
