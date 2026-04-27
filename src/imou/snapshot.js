/**
 * Imou Snapshot API
 *
 * Captures a snapshot from an Imou camera and returns the image URL.
 * Uses the `setDeviceSnap` API endpoint.
 */

const axios = require('axios');
const { callImouApi } = require('./client');
const logger = require('../utils/logger');

function inferImageContentType(buffer, headerValue = '', sourceUrl = '') {
  const header = String(headerValue || '').toLowerCase();
  if (header.startsWith('image/')) {
    return headerValue;
  }

  if (buffer?.length >= 4) {
    if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
      return 'image/jpeg';
    }

    if (
      buffer[0] === 0x89 &&
      buffer[1] === 0x50 &&
      buffer[2] === 0x4e &&
      buffer[3] === 0x47
    ) {
      return 'image/png';
    }

    if (
      buffer[0] === 0x47 &&
      buffer[1] === 0x49 &&
      buffer[2] === 0x46 &&
      buffer[3] === 0x38
    ) {
      return 'image/gif';
    }
  }

  const normalizedUrl = String(sourceUrl || '').toLowerCase();
  if (normalizedUrl.includes('.png')) return 'image/png';
  if (normalizedUrl.includes('.gif')) return 'image/gif';

  return 'image/jpeg';
}

async function downloadSnapshotWithRetry(snapshotUrl) {
  const delays = [0, 500, 1000, 2000];
  let lastError = null;

  for (const delayMs of delays) {
    if (delayMs > 0) {
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }

    try {
      return await axios.get(snapshotUrl, {
        responseType: 'arraybuffer',
        timeout: 30000,
        headers: {
          Accept: 'image/*,*/*;q=0.8',
        },
        maxRedirects: 5,
      });
    } catch (error) {
      lastError = error;
      const status = error.response?.status;
      const shouldRetry = status === 403 || status === 404 || !status;

      if (!shouldRetry) {
        throw error;
      }
    }
  }

  throw lastError;
}

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
    const response = await downloadSnapshotWithRetry(snapshotUrl);

    const buffer = Buffer.from(response.data);

    return {
      buffer,
      contentType: inferImageContentType(
        buffer,
        response.headers['content-type'],
        snapshotUrl
      ),
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
