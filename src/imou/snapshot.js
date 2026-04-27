/**
 * Imou Snapshot API
 *
 * Captures a snapshot from an Imou camera and returns the image URL.
 * Uses the `setDeviceSnap` API endpoint.
 */

const axios = require('axios');
const { callImouApi } = require('./client');
const logger = require('../utils/logger');

/**
 * Capture a snapshot from a camera.
 *
 * @param {string} deviceId - Imou device serial number
 * @param {string} [channelId='0'] - Channel ID
 * @returns {Promise<string>} URL of the captured snapshot image
 */
async function getSnapshot(deviceId, channelId = '0') {
  try {
    const data = await callImouApi('/setDeviceSnap', {
      deviceId,
      channelId,
    });

    const snapshotUrl = data?.url;

    if (!snapshotUrl) {
      logger.warn(`No snapshot URL returned for device ${deviceId}`);
      return null;
    }

    logger.info(`Snapshot captured for device ${deviceId}`, {
      url: snapshotUrl.substring(0, 80) + '...',
    });

    return snapshotUrl;
  } catch (error) {
    logger.error(`Failed to capture snapshot for device ${deviceId}`, {
      error: error.message,
    });
    return null;
  }
}

/**
 * Capture an enhanced snapshot (higher quality) from a camera.
 *
 * @param {string} deviceId - Imou device serial number
 * @param {string} [channelId='0'] - Channel ID
 * @returns {Promise<string>} URL of the captured snapshot image
 */
async function getSnapshotEnhanced(deviceId, channelId = '0') {
  try {
    const data = await callImouApi('/setDeviceSnapEnhanced', {
      deviceId,
      channelId,
    });

    return data?.url || null;
  } catch (error) {
    // Fall back to regular snapshot if enhanced is not supported
    logger.warn(`Enhanced snapshot failed for ${deviceId}, falling back to standard`, {
      error: error.message,
    });
    return getSnapshot(deviceId, channelId);
  }
}

/**
 * Capture a snapshot and download the image payload.
 *
 * @param {string} deviceId
 * @param {string} [channelId='0']
 * @returns {Promise<{buffer: Buffer, contentType: string, sourceUrl: string}|null>}
 */
async function getSnapshotBuffer(deviceId, channelId = '0') {
  const snapshotUrl = await getSnapshot(deviceId, channelId);
  if (!snapshotUrl) {
    return null;
  }

  try {
    const response = await axios.get(snapshotUrl, {
      responseType: 'arraybuffer',
      timeout: 30000,
      headers: {
        Accept: 'image/*,*/*;q=0.8',
      },
      maxRedirects: 5,
    });

    return {
      buffer: Buffer.from(response.data),
      contentType: response.headers['content-type'] || 'image/jpeg',
      sourceUrl: snapshotUrl,
    };
  } catch (error) {
    logger.error(`Failed to download snapshot image for device ${deviceId}`, {
      error: error.message,
    });
    return null;
  }
}

module.exports = { getSnapshot, getSnapshotEnhanced, getSnapshotBuffer };
