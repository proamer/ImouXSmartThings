/**
 * Imou Live Stream API
 *
 * Creates and retrieves HLS live stream URLs from Imou cameras.
 *
 * bindDeviceLive requires:
 *   - deviceId, channelId, streamId (0=HD, 1=SD)
 * Response has streams[].hls for the HLS URL.
 */

const { callImouApi } = require('./client');
const logger = require('../utils/logger');

/**
 * Create/bind a live stream address for a device.
 *
 * @param {string} deviceId   - Imou device serial number
 * @param {string} channelId  - Channel ID (e.g. '0')
 * @param {number} [streamId=0] - 0 = HD main, 1 = SD auxiliary
 * @returns {Promise<object>} { liveToken, liveStatus, streams: [{ hls, coverUrl, streamId }] }
 */
async function bindDeviceLive(deviceId, channelId = '0', streamId = 0) {
  const data = await callImouApi('/bindDeviceLive', {
    deviceId,
    channelId,
    streamId,          // integer, required
  });

  logger.info(`Live stream bound for ${deviceId}:${channelId} (streamId=${streamId})`);
  return data;
}

/**
 * Unbind (stop) a live stream to free server resources.
 *
 * @param {string} liveToken - Token from bindDeviceLive response
 * @returns {Promise<void>}
 */
async function unbindDeviceLive(liveToken) {
  try {
    await callImouApi('/unbindDeviceLive', { liveToken });
    logger.info(`Live stream unbound (token: ${liveToken?.substring(0, 12)}...)`);
  } catch (error) {
    logger.warn('Failed to unbind live stream', { error: error.message });
  }
}

/**
 * Get the HLS stream URL for a device.
 * Binds a new stream session (HD first, falls back to SD).
 *
 * @param {string} deviceId  - Imou device serial number
 * @param {string} channelId - Channel ID (e.g. '0')
 * @returns {Promise<{url: string, liveToken: string}|null>}
 */
async function getStreamUrl(deviceId, channelId = '0') {
  // Try HD (streamId=0) first, fall back to SD (streamId=1)
  for (const streamId of [0, 1]) {
    try {
      const result = await bindDeviceLive(deviceId, channelId, streamId);

      // Extract HLS URL from streams array
      const hlsUrl =
        result?.streams?.find((s) => s.hls)?.hls ||
        result?.hls ||
        null;

      if (hlsUrl) {
        logger.info(`HLS URL obtained for ${deviceId}:${channelId}`, {
          streamId,
          url: hlsUrl.substring(0, 80) + '...',
        });
        return {
          url: hlsUrl,
          liveToken: result?.liveToken || null,
          coverUrl: result?.streams?.find((s) => s.coverUrl)?.coverUrl || null,
        };
      }
    } catch (error) {
      logger.warn(`bindDeviceLive failed (streamId=${streamId}) for ${deviceId}`, {
        error: error.message,
        code: error.code,
      });
    }
  }

  logger.warn(`Could not obtain HLS URL for ${deviceId}:${channelId}`);
  return null;
}

module.exports = {
  bindDeviceLive,
  unbindDeviceLive,
  getStreamUrl,
};
