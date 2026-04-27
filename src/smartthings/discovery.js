/**
 * SmartThings Schema — Discovery Handler
 *
 * Handles `discoveryRequest` from SmartThings Cloud.
 * Fetches all Imou cameras and maps them to SmartThings device profiles.
 *
 * IMPORTANT: Discovery response must include initial `states` for each device
 * so SmartThings knows the device is online from the start.
 * Without initial states, SmartThings defaults to offline/unavailable.
 *
 * Capabilities declared per camera channel:
 * - st.videoCamera    (camera on/off/unavailable)
 * - st.videoStream    (HLS stream URL)
 * - st.imageCapture   (snapshot URL)
 * - st.switch         (on/off control)
 * - st.healthCheck    (online/offline status)
 */

const { listAllDevices } = require('../imou/devices');
const logger = require('../utils/logger');

/**
 * Build the initial states for a newly discovered camera.
 * We report online/on optimistically; stateRefresh will correct if wrong.
 *
 * @returns {Array} Initial states array
 */
function buildInitialStates() {
  return [
    {
      component: 'main',
      capability: 'st.healthCheck',
      attribute: 'healthStatus',
      value: 'online',
    },
    {
      component: 'main',
      capability: 'st.switch',
      attribute: 'switch',
      value: 'on',
    },
    {
      component: 'main',
      capability: 'st.videoCamera',
      attribute: 'camera',
      value: 'on',
    },
  ];
}

/**
 * Handle a SmartThings discovery request.
 *
 * @param {string} requestId - The requestId from SmartThings
 * @returns {Promise<object>} Discovery response payload
 */
async function handleDiscovery(requestId) {
  logger.info('Processing SmartThings discovery request', { requestId });

  try {
    const devices = await listAllDevices();
    const discoveredDevices = [];

    for (const device of devices) {
      const deviceId = device.deviceId;
      const channels = device.channels || [{ channelId: '0' }];

      for (const channel of channels) {
        const channelId = channel.channelId || '0';
        const externalDeviceId = `imou-${deviceId}-${channelId}`;
        const friendlyName = channel.channelName || `Imou Camera ${deviceId}`;

        const deviceProfile = {
          externalDeviceId,
          friendlyName,
          deviceHandlerType: 'c2c-camera',
          manufacturerInfo: {
            manufacturerName: 'Imou',
            modelName: channel.productId || 'IPC',
            hwVersion: '1.0',
            swVersion: '1.0',
          },
          deviceContext: {
            roomName: '',
            groups: [],
            categories: ['camera'],
          },
          deviceUniqueId: externalDeviceId,
          // Initial states — required so SmartThings doesn't show device as offline immediately
          states: buildInitialStates(),
        };

        discoveredDevices.push(deviceProfile);
      }
    }

    logger.info(`Discovery complete: found ${discoveredDevices.length} devices`);

    return {
      headers: {
        schema: 'st-schema',
        version: '1.0',
        interactionType: 'discoveryResponse',
        requestId,
      },
      devices: discoveredDevices,
    };
  } catch (error) {
    logger.error('Discovery failed', { error: error.message });

    return {
      headers: {
        schema: 'st-schema',
        version: '1.0',
        interactionType: 'discoveryResponse',
        requestId,
      },
      devices: [],
    };
  }
}

module.exports = { handleDiscovery };
