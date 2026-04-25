/**
 * Imou Device Management
 *
 * Provides functions to list devices, check online status,
 * and query device capabilities from the Imou Open Platform.
 *
 * Uses `deviceBaseList` to list devices bound to the Imou Life app.
 * Parameters must use correct types: numbers for bindId/limit, boolean for needApInfo.
 */

const { callImouApi } = require('./client');
const logger = require('../utils/logger');

/**
 * List devices registered on the Imou Life app using cursor-based pagination.
 * Uses the `deviceBaseList` API for consumer (Imou Life) bound devices.
 *
 * @param {number} [bindId=-1] - Last bindId from previous query (-1 for first)
 * @param {number} [limit=128] - Number of entries per page (max 128)
 * @returns {Promise<object>} { deviceList: [...], count: number }
 */
async function listDevices(bindId = -1, limit = 128) {
  const data = await callImouApi('/deviceBaseList', {
    bindId,
    limit,
    type: 'bindAndShare',
    needApInfo: true,
  });

  logger.info(`Listed ${data.deviceList?.length || 0} devices (bindId: ${bindId})`);
  return data;
}

/**
 * Get all devices across all pages using cursor-based pagination.
 *
 * @returns {Promise<Array>} All devices
 */
async function listAllDevices() {
  const allDevices = [];
  let bindId = -1;
  const limit = 128;

  while (true) {
    const data = await listDevices(bindId, limit);
    const devices = data.deviceList || [];
    allDevices.push(...devices);

    // If we got fewer devices than the limit, we've fetched all
    if (devices.length < limit) break;

    // Use the last device's bindId for cursor-based pagination
    const lastDevice = devices[devices.length - 1];
    bindId = lastDevice.bindId;
    if (!bindId && bindId !== 0) break;
  }

  logger.info(`Total devices found: ${allDevices.length}`);
  return allDevices;
}

/**
 * Check if a device is online.
 *
 * @param {string} deviceId - Imou device serial number
 * @param {string} [channelId='0'] - Channel ID
 * @returns {Promise<object>} { onLine: "1" | "0" }
 */
async function getDeviceOnline(deviceId, channelId = '0') {
  const data = await callImouApi('/deviceOnline', {
    deviceId,
    channelId,
  });

  return data;
}

/**
 * Get device capabilities/abilities.
 *
 * @param {string} deviceId - Imou device serial number
 * @returns {Promise<object>} Device ability information
 */
async function getDeviceAbility(deviceId) {
  try {
    const data = await callImouApi('/listDeviceAbility', {
      deviceId,
    });
    return data;
  } catch (error) {
    logger.warn(`Failed to get abilities for device ${deviceId}`, {
      error: error.message,
    });
    return null;
  }
}

/**
 * Get detailed information about a specific device channel.
 *
 * @param {string} deviceId - Imou device serial number
 * @param {string} [channelId='0'] - Channel ID
 * @returns {Promise<object>} Channel detail info
 */
async function getDeviceChannelInfo(deviceId, channelId = '0') {
  try {
    const data = await callImouApi('/bindDeviceChannelInfo', {
      deviceId,
      channelId,
    });
    return data;
  } catch (error) {
    logger.warn(`Failed to get channel info for ${deviceId}:${channelId}`, {
      error: error.message,
    });
    return null;
  }
}

module.exports = {
  listDevices,
  listAllDevices,
  getDeviceOnline,
  getDeviceAbility,
  getDeviceChannelInfo,
};
