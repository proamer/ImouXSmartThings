/**
 * Imou Live Stream API
 *
 * Creates and retrieves HLS/RTMP live stream URLs from Imou cameras.
 * Uses `bindDeviceLive` and `getLiveStreamInfo` APIs.
 */

const { callImouApi } = require('./client');
const logger = require('../utils/logger');

/**
 * Create a live stream address for a device.
 * This binds the device to an HLS live stream endpoint.
 *
 * @param {string} deviceId - Imou device serial number
 * @param {string} [channelId='0'] - Channel ID
 * @returns {Promise<object>} Live stream details { liveToken, streams: [...] }
 */
async function bindDeviceLive(deviceId, channelId = '0') {
  try {
    const data = await callImouApi('/bindDeviceLive', {
      deviceId,
      channelId,
    });

    logger.info(`Live stream bound for device ${deviceId}`);
    return data;
  } catch (error) {
    logger.error(`Failed to bind live stream for device ${deviceId}`, {
      error: error.message,
    });
    throw error;
  }
}

/**
 * Get existing live stream info (URL + status) for a device.
 *
 * @param {string} deviceId - Imou device serial number
 * @param {string} [channelId='0'] - Channel ID
 * @returns {Promise<object|null>} Live stream info or null
 */
async function getLiveStreamInfo(deviceId, channelId = '0') {
  try {
    const data = await callImouApi('/getLiveStreamInfo', {
      deviceId,
      channelId,
    });

    return data;
  } catch (error) {
    logger.warn(`Failed to get live stream info for ${deviceId}`, {
      error: error.message,
    });
    return null;
  }
}

/**
 * Get the live stream list for a device.
 *
 * @param {string} deviceId - Imou device serial number
 * @param {string} [channelId='0'] - Channel ID
 * @returns {Promise<Array>} List of live streams
 */
async function getLiveList(deviceId, channelId = '0') {
  try {
    const data = await callImouApi('/liveList', {
      deviceId,
      channelId,
    });

    return data?.lives || [];
  } catch (error) {
    logger.warn(`Failed to get live list for ${deviceId}`, {
      error: error.message,
    });
    return [];
  }
}

/**
 * Get a usable HLS stream URL for a device.
 * Tries getLiveStreamInfo first, falls back to bindDeviceLive.
 *
 * @param {string} deviceId - Imou device serial number
 * @param {string} [channelId='0'] - Channel ID
 * @returns {Promise<string|null>} HLS stream URL or null
 */
async function getStreamUrl(deviceId, channelId = '0') {
  // Try getting existing stream info first
  const streamInfo = await getLiveStreamInfo(deviceId, channelId);
  if (streamInfo?.hls) {
    return streamInfo.hls;
  }

  // If no existing stream, try to bind a new one
  try {
    const bindResult = await bindDeviceLive(deviceId, channelId);
    if (bindResult?.hls) {
      return bindResult.hls;
    }
    // Some responses have the URL nested in streams array
    if (bindResult?.streams?.length > 0) {
      return bindResult.streams[0].hls || bindResult.streams[0].url;
    }
  } catch (error) {
    logger.warn(`Could not get stream URL for ${deviceId}`);
  }

  return null;
}

module.exports = {
  bindDeviceLive,
  getLiveStreamInfo,
  getLiveList,
  getStreamUrl,
};
