/**
 * SmartThings Schema — Discovery Handler
 *
 * Handles `discoveryRequest` from SmartThings Cloud.
 * Fetches all Imou cameras and maps them to SmartThings device profiles.
 *
 * Each camera is reported with these capabilities:
 * - st.switch (on/off)
 * - st.videoCamera (camera status)
 * - st.imageCapture (snapshot)
 * - st.refresh (manual refresh)
 */

const { listAllDevices, getDeviceOnline } = require('../imou/devices');
const logger = require('../utils/logger');

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
