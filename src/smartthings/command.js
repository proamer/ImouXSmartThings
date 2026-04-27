/**
 * SmartThings Schema — Command Handler
 *
 * Handles `commandRequest` from SmartThings Cloud.
 * Translates SmartThings capabilities/commands to Imou API calls.
 *
 * Supported commands:
 * - st.switch → on/off → Imou setDeviceCameraStatus
 * - st.imageCapture → take → Imou setDeviceSnap
 * - st.refresh → refresh → Re-query all states
 * - Custom PTZ commands → Imou controlMovePTZ / controlLocationPTZ
 */

const { parseExternalDeviceId } = require('./stateRefresh');
const { getStreamUrl, toSmartThingsStream } = require('../imou/live');
const { getDeviceOnline } = require('../imou/devices');
const { movePTZ, locationPTZ, stopPTZ, PTZ_DIRECTION } = require('../imou/ptz');
const { callImouApi } = require('../imou/client');
const logger = require('../utils/logger');
const { buildSnapshotProxyUrl } = require('../utils/publicUrl');

/**
 * Process a single command for a device.
 *
 * @param {string} externalDeviceId - SmartThings external device ID
 * @param {object} command - { component, capability, command, arguments }
 * @returns {Promise<object>} Updated device state
 */
async function processCommand(externalDeviceId, command, context = {}) {
  const { deviceId, channelId } = parseExternalDeviceId(externalDeviceId);
  const { capability, command: cmd, arguments: args } = command;
  const { baseUrl = '' } = context;
  const states = [];

  logger.info(`Processing command`, {
    externalDeviceId,
    capability,
    command: cmd,
    args,
  });

  try {
    switch (capability) {
      // ━━━ Switch (on/off) ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
      case 'st.switch': {
        const enableValue = cmd === 'on' ? 'true' : 'false';

        try {
          await callImouApi('/setDeviceCameraStatus', {
            deviceId,
            channelId,
            enableType: 'headerDetect',
            enable: enableValue,
          });
        } catch (e) {
          // setDeviceCameraStatus may not be supported on all devices
          logger.warn(`setDeviceCameraStatus failed for ${deviceId}`, {
            error: e.message,
          });
        }

        states.push({
          component: 'main',
          capability: 'st.switch',
          attribute: 'switch',
          value: cmd === 'on' ? 'on' : 'off',
        });
        states.push({
          component: 'main',
          capability: 'st.videoCamera',
          attribute: 'camera',
          value: cmd === 'on' ? 'on' : 'off',
        });
        break;
      }

      // ━━━ Image Capture (snapshot) ━━━━━━━━━━━━━━━━━━━━━━━━
      case 'st.imageCapture': {
        const snapshotUrl = buildSnapshotProxyUrl(baseUrl, deviceId, channelId);
        states.push({
          component: 'main',
          capability: 'st.imageCapture',
          attribute: 'image',
          value: snapshotUrl || '',
        });
        break;
      }

      // ━━━ Refresh ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
      case 'st.refresh': {
        // Re-query online status
        const onlineData = await getDeviceOnline(deviceId, channelId);
        const isOnline = onlineData?.onLine === '1';

        states.push({
          component: 'main',
          capability: 'st.switch',
          attribute: 'switch',
          value: isOnline ? 'on' : 'off',
        });
        states.push({
          component: 'main',
          capability: 'st.videoCamera',
          attribute: 'camera',
          value: isOnline ? 'on' : 'unavailable',
        });

        if (isOnline) {
          const newSnapshot = buildSnapshotProxyUrl(baseUrl, deviceId, channelId);
          if (newSnapshot) {
            states.push({
              component: 'main',
              capability: 'st.imageCapture',
              attribute: 'image',
              value: newSnapshot,
            });
          }

          const streamResult = await getStreamUrl(deviceId, channelId);
          const smartThingsStream = toSmartThingsStream(streamResult);
          if (smartThingsStream) {
            states.push({
              component: 'main',
              capability: 'st.videoStream',
              attribute: 'stream',
              value: smartThingsStream,
            });
          }
        }

        states.push({
          component: 'main',
          capability: 'st.healthCheck',
          attribute: 'healthStatus',
          value: isOnline ? 'online' : 'offline',
        });
        break;
      }

      // SmartThings requests live video by issuing startStream / stopStream commands
      case 'st.videoStream': {
        if (cmd === 'startStream') {
          const streamResult = await getStreamUrl(deviceId, channelId);
          const smartThingsStream = toSmartThingsStream(streamResult);

          if (smartThingsStream) {
            states.push({
              component: 'main',
              capability: 'st.videoStream',
              attribute: 'stream',
              value: smartThingsStream,
            });
            states.push({
              component: 'main',
              capability: 'st.videoCamera',
              attribute: 'camera',
              value: 'on',
            });
          } else {
            states.push({
              component: 'main',
              capability: 'st.videoCamera',
              attribute: 'camera',
              value: 'unavailable',
            });
          }
        }

        if (cmd === 'stopStream') {
          states.push({
            component: 'main',
            capability: 'st.videoStream',
            attribute: 'stream',
            value: {
              InHomeURL: '',
              OutHomeURL: '',
            },
          });
        }

        break;
      }

      // ━━━ PTZ Move (custom) ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
      case 'ptzControl': {
        const direction = args?.[0] || args?.direction;
        const duration = args?.[1] || args?.duration || 500;

        // Map direction string to PTZ_DIRECTION code
        const directionMap = {
          up: PTZ_DIRECTION.UP,
          down: PTZ_DIRECTION.DOWN,
          left: PTZ_DIRECTION.LEFT,
          right: PTZ_DIRECTION.RIGHT,
          leftUp: PTZ_DIRECTION.LEFT_UP,
          leftDown: PTZ_DIRECTION.LEFT_DOWN,
          rightUp: PTZ_DIRECTION.RIGHT_UP,
          rightDown: PTZ_DIRECTION.RIGHT_DOWN,
          stop: PTZ_DIRECTION.STOP,
        };

        const dirCode = directionMap[direction] || PTZ_DIRECTION.STOP;
        await movePTZ(deviceId, channelId, dirCode, duration);

        states.push({
          component: 'main',
          capability: 'ptzControl',
          attribute: 'ptzMovement',
          value: direction || 'stop',
        });
        break;
      }

      // ━━━ PTZ Location (custom) ━━━━━━━━━━━━━━━━━━━━━━━━━
      case 'ptzPosition': {
        const h = args?.h || args?.[0] || 0;
        const v = args?.v || args?.[1] || 0;
        const z = args?.z || args?.[2] || 50;
        await locationPTZ(deviceId, channelId, h, v, z);

        states.push({
          component: 'main',
          capability: 'ptzPosition',
          attribute: 'position',
          value: { h, v, z },
        });
        break;
      }

      default:
        logger.warn(`Unknown capability: ${capability}`, { command: cmd });
    }
  } catch (error) {
    logger.error(`Command execution failed`, {
      externalDeviceId,
      capability,
      command: cmd,
      error: error.message,
    });
  }

  return {
    externalDeviceId,
    states,
  };
}

/**
 * Handle a SmartThings command request.
 *
 * @param {string} requestId - The requestId from SmartThings
 * @param {Array<object>} devices - List of device command objects
 * @returns {Promise<object>} Command response payload
 */
async function handleCommand(requestId, devices = [], context = {}) {
  logger.info('Processing SmartThings command request', {
    requestId,
    deviceCount: devices.length,
  });

  const deviceStates = [];

  for (const device of devices) {
    const { externalDeviceId, commands } = device;

    for (const command of commands) {
      const result = await processCommand(externalDeviceId, command, context);
      deviceStates.push(result);
    }
  }

  logger.info(`Command processing complete for ${deviceStates.length} device(s)`);

  return {
    headers: {
      schema: 'st-schema',
      version: '1.0',
      interactionType: 'commandResponse',
      requestId,
    },
    deviceState: deviceStates,
  };
}

module.exports = { handleCommand };
