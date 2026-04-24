/**
 * SmartThings Schema — State Refresh Handler
 *
 * Handles `stateRefreshRequest` from SmartThings Cloud.
 * For each requested device, queries Imou API for:
 * - Online status → st.switch + st.videoCamera
 * - Snapshot URL → st.imageCapture
 */

const { getDeviceOnline } = require('../imou/devices');
const { getSnapshot } = require('../imou/snapshot');
const { getStreamUrl } = require('../imou/live');
const logger = require('../utils/logger');

/**
 * Parse an external device ID back into Imou device/channel IDs.
 * Format: "imou-{deviceId}-{channelId}"
 *
 * @param {string} externalDeviceId
 * @returns {{ deviceId: string, channelId: string }}
 */
function parseExternalDeviceId(externalDeviceId) {
  const parts = externalDeviceId.replace('imou-', '').split('-');
  // Device ID might contain hyphens (unlikely but safe)
  const channelId = parts.pop();
  const deviceId = parts.join('-');
  return { deviceId, channelId };
}

/**
 * Build the device state array for a single device.
 *
 * @param {string} externalDeviceId
 * @returns {Promise<object>} SmartThings device state object
 */
async function getDeviceState(externalDeviceId) {
  const { deviceId, channelId } = parseExternalDeviceId(externalDeviceId);
  const states = [];

  try {
    // 1. Check online status
    const onlineData = await getDeviceOnline(deviceId, channelId);
    const isOnline = onlineData?.onLine === '1';

    // st.switch
    states.push({
      component: 'main',
      capability: 'st.switch',
      attribute: 'switch',
      value: isOnline ? 'on' : 'off',
    });

    // st.videoCamera
    states.push({
      component: 'main',
      capability: 'st.videoCamera',
      attribute: 'camera',
      value: isOnline ? 'on' : 'unavailable',
    });

    // 2. Get snapshot URL (only if online)
    if (isOnline) {
      const snapshotUrl = await getSnapshot(deviceId, channelId);
      if (snapshotUrl) {
        states.push({
          component: 'main',
          capability: 'st.imageCapture',
          attribute: 'image',
          value: snapshotUrl,
        });
      }

      // 3. Try to get HLS stream URL
      const streamUrl = await getStreamUrl(deviceId, channelId);
      if (streamUrl) {
        states.push({
          component: 'main',
          capability: 'st.videoStream',
          attribute: 'stream',
          value: {
            protocol: 'hls',
            uri: streamUrl,
          },
        });
      }
    }

    // st.healthCheck
    states.push({
      component: 'main',
      capability: 'st.healthCheck',
      attribute: 'healthStatus',
      value: isOnline ? 'online' : 'offline',
    });
  } catch (error) {
    logger.error(`Failed to get state for device ${externalDeviceId}`, {
      error: error.message,
    });

    // Return offline state on error
    states.push(
      {
        component: 'main',
        capability: 'st.switch',
        attribute: 'switch',
        value: 'off',
      },
      {
        component: 'main',
        capability: 'st.videoCamera',
        attribute: 'camera',
        value: 'unavailable',
      },
      {
        component: 'main',
        capability: 'st.healthCheck',
        attribute: 'healthStatus',
        value: 'offline',
      }
    );
  }

  return {
    externalDeviceId,
    states,
  };
}

/**
 * Handle a SmartThings state refresh request.
 *
 * @param {string} requestId - The requestId from SmartThings
 * @param {Array<object>} devices - List of { externalDeviceId } to refresh
 * @returns {Promise<object>} State refresh response payload
 */
async function handleStateRefresh(requestId, devices = []) {
  logger.info('Processing SmartThings state refresh request', {
    requestId,
    deviceCount: devices.length,
  });

  const deviceStates = [];

  // Process all devices in parallel for better performance
  const statePromises = devices.map((device) =>
    getDeviceState(device.externalDeviceId)
  );

  const results = await Promise.allSettled(statePromises);

  for (const result of results) {
    if (result.status === 'fulfilled') {
      deviceStates.push(result.value);
    }
  }

  logger.info(`State refresh complete for ${deviceStates.length} devices`);

  return {
    headers: {
      schema: 'st-schema',
      version: '1.0',
      interactionType: 'stateRefreshResponse',
      requestId,
    },
    deviceState: deviceStates,
  };
}

module.exports = { handleStateRefresh, parseExternalDeviceId };
