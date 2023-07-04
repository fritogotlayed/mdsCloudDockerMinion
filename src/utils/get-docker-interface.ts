import Docker from 'dockerode';

export function GetDockerInterface() {
  return new Docker({ socketPath: '/var/run/docker.sock' });
}
