/**
 * Imou Device Management
 *
 * Provides functions to list devices, check online status,
 * and query device capabilities from the Imou Open Platform.
 */

const { callImouApi } = require('./client');
const logger = require('../utils/logger');

/**
 * List all devices registered on the Imou account.
 * Uses the `deviceOpenList` API for paginated device listing.
 *
 * @param {number} [page=1] - Page number (1-indexed)
 * @param {number} [pageSize=50] - Number of devices per page
 * @returns {Promise<object>} { deviceList: [...], count: number }
 */
async function listDevices(page = 1, pageSize = 50) {
  const data = await callImouApi('/deviceOpenList', {
    pageSize: String(pageSize),
    page: String(page),
  });

  logger.info(`Listed ${data.deviceList?.length || 0} devices (page ${page})`);
  return data;
}

/**
 * Get all devices across all pages.
 *
 * @returns {Promise<Array>} All devices
 */
async function listAllDevices() {
  const allDevices = [];
  let page = 1;
  const pageSize = 50;

  while (true) {
    const data = await listDevices(page, pageSize);
    const devices = data.deviceList || [];
    allDevices.push(...devices);

    if (devices.length < pageSize) break;
    page++;
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
