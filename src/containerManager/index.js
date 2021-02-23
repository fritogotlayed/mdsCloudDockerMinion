const _ = require('lodash');
const luxon = require('luxon');

const globals = require('../globals');
const helpers = require('../helpers');
const SimpleThrottle = require('../simpleThrottle');

const maxStoppedContainerSeconds = 60;
const maxRunningContainerSeconds = 15;

const self = {
  monitorHandle: undefined,

  // TODO: Move to a distributed store. Maybe redis or mongo?
  // TODO: Manage "dangling" image versions
  containerMetadata: {},

  simpleThrottle: new SimpleThrottle(),

  /**
   * @param {String} imageNameFragment the image name fragment to filter by
   * @param {Object} options
   * @param {Boolean} options.onlyRunning True to return only running containers. Default False.
   */
  findContainersMatchingImage: async (imageNameFragment, options) => {
    const docker = globals.getDockerInterface();
    const containers = await docker.listContainers({
      all: !_.get(options, ['onlyRunning'], false),
    });
    const filtered = _.filter(containers, (el) => el.Image.indexOf(imageNameFragment) !== -1);
    return filtered;
  },

  startMonitor: () => {
    if (!self.monitorHandle) {
      const interval = 15; // seconds
      self.monitorHandle = setInterval(() => {
        self.handleOrphanedContainers();
      }, interval * 1000);
    }
  },

  stopMonitor: () => {
    if (self.monitorHandle) {
      clearInterval(self.monitorHandle);
      self.monitorHandle = undefined;
    }
  },

  safeStopContainer: async (container) => {
    try {
      await container.stop();
      return Promise.resolve();
    } catch (err) {
      // Eat the exception
      if (err.message.indexOf('container already stopped') > -1) {
        return Promise.resolve();
      }
      throw err;
    }
  },

  safeStartContainer: async (container) => {
    try {
      await container.start();
      return Promise.resolve();
    } catch (err) {
      // Eat the exception
      if (err.message.indexOf('container already started') > -1) {
        return Promise.resolve();
      }
      throw err;
    }
  },

  handleOrphanedContainers: async () => {
    const docker = globals.getDockerInterface();
    const filtered = await self.findContainersMatchingImage('mds-sf-');
    _.map(filtered, async (info) => {
      const container = docker.getContainer(info.Id);
      const insp = await container.inspect();
      /*
        {
          id: 'b89e77f97f8c2905b416abb72c7d7b89e941f8587f7c7d178c4be80e6fe10e5a',
          state: {
            Status: 'exited',
            Running: false,
            Paused: false,
            Restarting: false,
            OOMKilled: false,
            Dead: false,
            Pid: 0,
            ExitCode: 137,
            Error: '',
            StartedAt: '2021-02-20T04:07:35.971210876Z',
            FinishedAt: '2021-02-20T04:07:48.637083233Z'
          }
        }
      */
      // Remove dead orphaned containers
      if (!(
        insp.State.Running
        || insp.State.Paused
        || insp.State.Restarting
        || insp.State.OOMKilled
        || insp.State.Dead)
      ) {
        const stoppedAt = luxon.DateTime.fromISO(insp.State.FinishedAt);
        const diff = stoppedAt.diffNow('seconds');
        if (Math.abs(diff.seconds) > maxStoppedContainerSeconds) {
          delete self.containerMetadata[info.Id];
          container.remove();
        }
      }

      // Remove orphaned or runtime exceeded containers
      if (insp.State.Running) {
        const meta = self.containerMetadata[info.Id];
        const lastCall = _.get(meta, ['lastCall'], luxon.DateTime.fromISO(insp.State.StartedAt));
        const diff = lastCall.diffNow('seconds');
        if (Math.abs(diff.seconds) > maxRunningContainerSeconds) {
          self.safeStopContainer(container);
        }
      }
    });
  },

  /**
   * Finds existing containers, running or not, to be readied for user function calls
   *
   * NOTE: This is not throttled. Use readyFunctionContainerForImage instead.
   * @param {string} fullImageName The image name and version
   */
  electExistingContainerToReadyForImage: async (fullImageName) => {
    const logger = globals.getLogger();
    const existingContainers = await self.findContainersMatchingImage(fullImageName);
    const runningContainers = _.filter(existingContainers, (e) => e.State.toUpperCase() === 'RUNNING');
    const exitedContainers = _.filter(existingContainers, (e) => e.State.toUpperCase() === 'EXITED');

    const docker = globals.getDockerInterface();
    let container;
    if (runningContainers.length > 0) {
      const random = globals.getRandomInt(runningContainers.length);
      const elect = runningContainers[random];
      container = docker.getContainer(elect.Id);
      logger.trace({
        fullImageName,
      }, 'Existing running container found.');
    } else if (exitedContainers.length > 0) {
      const promises = _.map(exitedContainers, (c) => docker.getContainer(c.Id).inspect());
      const details = await Promise.all(promises);
      const elect = _.maxBy(
        details,
        (e) => luxon.DateTime.fromISO(e.State.FinishedAt).toMillis(),
      );

      // Give a slight buffer on re-using a stopped container
      const stoppedAt = luxon.DateTime.fromISO(elect.State.FinishedAt);
      const diff = stoppedAt.diffNow('seconds');
      if (Math.abs(diff.seconds) < (maxStoppedContainerSeconds - 5)) {
        container = docker.getContainer(elect.Id);
        await self.safeStartContainer(container);
        logger.trace({
          fullImageName,
        }, 'Existing stopped container found and restarted.');
      }
    }

    return container;
  },

  // TODO: Add max retries to prevent infinite loop.
  readyFunctionContainerForImage: async (fullTagName, tagVersion) => {
    const logger = globals.getLogger();
    const fullImageName = `${fullTagName}:${tagVersion}`;

    await self.simpleThrottle.acquire(fullImageName);
    let returnData;
    try {
      let container = await self.electExistingContainerToReadyForImage(fullImageName);
      if (!container) {
        const docker = globals.getDockerInterface();
        container = await docker.createContainer({
          Image: `${fullTagName}:${tagVersion}`,
          name: `mds-sf-${globals.generateRandomString(24)}`,
          HostConfig: {
            NetworkMode: _.get(process.env, ['MDS_FN_CONTAINER_NETWORK'], 'bridge'),
          },
        });
        await self.safeStartContainer(container);
        logger.trace({
          fullImageName,
        }, 'No container found. New container started.');
      }

      const customNetwork = helpers.getEnvVar('MDS_FN_CONTAINER_NETWORK', '');
      const ip = await container.inspect().then((info) => (customNetwork === ''
        ? info.NetworkSettings.IPAddress
        : info.NetworkSettings.Networks[customNetwork].IPAddress));
      logger.trace({
        fullImageName,
        ip,
      }, 'Discovering IP for container');
      if (ip) {
        const extendedMeta = _.get(self.containerMetadata, [container.id], {});
        extendedMeta.openCalls = _.get(extendedMeta, ['openCalls'], 0) + 1;
        extendedMeta.lastCall = luxon.DateTime.now();
        extendedMeta.image = fullImageName;
        extendedMeta.ip = ip;
        self.containerMetadata[container.id] = extendedMeta;
        returnData = {
          handle: container.id,
          ip,
        };
        logger.trace({
          fullImageName,
          extendedMeta,
        }, 'Metadata for IP found');
      }
    } catch (err) {
      logger.error({ fullTagName, tagVersion, err }, 'A problem occurred while trying to ready the container for image');
    } finally {
      self.simpleThrottle.release(fullImageName);
    }

    if (returnData) return returnData;
    return self.readyFunctionContainerForImage(fullTagName, tagVersion);
  },

  releaseFunctionContainer: (handle) => {
    const newVal = _.get(self.containerMetadata, [handle, 'openCalls'], 1) - 1;
    self.containerMetadata[handle].openCalls = _.max([newVal, 0]);
    // if (newVal === 0) {
    //   delete self.containerMetadata[handle];
    //   const docker = globals.getDockerInterface();
    //   const container = docker.getContainer(handle);
    //   try {
    //     self.safeStopContainer(container);
    //   } catch (err) {
    //     // Eat the exception
    //     if (!err.message.indexOf('container already stopped') > -1) {
    //       throw err;
    //     }
    //   }
    // } else {
    //   self.containerMetadata[handle].openCalls = newVal;
    // }
  },
};

module.exports = self;
