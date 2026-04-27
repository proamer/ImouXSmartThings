/**
 * SmartThings Schema — State Refresh Handler
 *
 * Handles `stateRefreshRequest` from SmartThings Cloud.
 * For each requested device, queries Imou API for:
 * - Online status → st.switch + st.videoCamera
 * - Snapshot URL → st.imageCapture
 */

const { getDeviceOnline } = require('../imou/devices');
const { toSmartThingsStream } = require('../imou/live');
const logger = require('../utils/logger');
const { buildLiveStreamProxyUrl, buildSnapshotProxyUrl } = require('../utils/publicUrl');

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
async function getDeviceState(externalDeviceId, baseUrl) {
  const { deviceId, channelId } = parseExternalDeviceId(externalDeviceId);
  const states = [];

  try {
    // 1. Check online status
    // deviceOnline returns { deviceId, onLine: '1'|'0', channels: [...] }
    const onlineData = await getDeviceOnline(deviceId, channelId);
    const isOnline = onlineData?.onLine === '1';

    // st.videoCamera
    states.push({
      component: 'main',
      capability: 'st.videoCamera',
      attribute: 'camera',
      value: isOnline ? 'on' : 'unavailable',
    });

    // 2. Get snapshot URL (only if online)
    if (isOnline) {
      try {
        const snapshotUrl = buildSnapshotProxyUrl(baseUrl, deviceId, channelId);
        if (snapshotUrl) {
          states.push({
            component: 'main',
            capability: 'st.imageCapture',
            attribute: 'image',
            value: snapshotUrl,
          });
        }
      } catch (snapErr) {
        logger.warn(`Snapshot failed for ${deviceId}:${channelId}`, { error: snapErr.message });
      }

      // 3. Publish a proxied HLS URL on our public HTTPS host.
      try {
        const streamUrl = buildLiveStreamProxyUrl(baseUrl, deviceId, channelId);
        const smartThingsStream = toSmartThingsStream(streamUrl);
        if (smartThingsStream) {
          states.push({
            component: 'main',
            capability: 'st.videoStream',
            attribute: 'stream',
            value: smartThingsStream,
          });
        }
      } catch (streamErr) {
        logger.warn(`Stream URL failed for ${deviceId}:${channelId}`, { error: streamErr.message });
      }
    }

    // st.healthCheck — both attributes required for c2c-camera
    states.push(
      {
        component: 'main',
        capability: 'st.healthCheck',
        attribute: 'healthStatus',
        value: isOnline ? 'online' : 'offline',
      },
      {
        component: 'main',
        capability: 'st.healthCheck',
        attribute: 'DeviceWatch-DeviceStatus',
        value: isOnline ? 'online' : 'offline',
      }
    );
  } catch (error) {
    logger.error(`Failed to get state for device ${externalDeviceId}`, {
      error: error.message,
    });

    // Return offline state on error
    states.push(
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
      },
      {
        component: 'main',
        capability: 'st.healthCheck',
        attribute: 'DeviceWatch-DeviceStatus',
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
async function handleStateRefresh(requestId, devices = [], context = {}) {
  logger.info('Processing SmartThings state refresh request', {
    requestId,
    deviceCount: devices.length,
  });

  const { baseUrl = '' } = context;
  const deviceStates = [];

  // Process all devices in parallel for better performance
  const statePromises = devices.map((device) =>
    getDeviceState(device.externalDeviceId, baseUrl)
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
