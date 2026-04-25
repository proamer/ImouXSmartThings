/**
 * Imou Live Stream API
 *
 * Creates and retrieves HLS live stream URLs from Imou cameras.
 *
 * bindDeviceLive requires: deviceId, channelId, streamId (0=HD, 1=SD)
 * LV1001 means stream session already exists → use getLiveStreamInfo instead.
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
    streamId,    // integer, required by Imou API
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
    logger.info(`Live stream unbound (token: ${String(liveToken).substring(0, 20)}...)`);
  } catch (error) {
    logger.warn('Failed to unbind live stream', { error: error.message });
  }
}

/**
 * Get an existing live stream info for a device (when stream already bound = LV1001).
 *
 * @param {string} deviceId   - Imou device serial number
 * @param {string} channelId  - Channel ID
 * @returns {Promise<{url: string, liveToken: string}|null>}
 */
async function getLiveStreamInfo(deviceId, channelId = '0') {
  try {
    const data = await callImouApi('/getLiveStreamInfo', { deviceId, channelId });

    // Prefer HTTPS streams (proto=https) over HTTP for SmartThings compatibility
    const streams = data?.streams || [];
    const httpsStream = streams.find((s) => s.hls?.startsWith('https://'));
    const httpStream = streams.find((s) => s.hls?.startsWith('http://'));
    const chosen = httpsStream || httpStream;

    if (chosen?.hls) {
      logger.info(`getLiveStreamInfo: using ${httpsStream ? 'HTTPS' : 'HTTP'} stream for ${deviceId}`);
      return {
        url: chosen.hls,
        liveToken: chosen?.liveToken || null,
        coverUrl: chosen?.coverUrl || null,
      };
    }
    return null;
  } catch (error) {
    logger.warn(`getLiveStreamInfo failed for ${deviceId}`, { error: error.message });
    return null;
  }
}

/**
 * Get a usable HLS stream URL for a device.
 *
 * Strategy:
 *   1. Try bindDeviceLive (streamId=0 HD)
 *   2. If LV1001 (stream already exists) → call getLiveStreamInfo to get existing URL
 *   3. If getLiveStreamInfo also fails → unbind old session then rebind
 *   4. Fallback to SD (streamId=1)
 *
 * @param {string} deviceId  - Imou device serial number
 * @param {string} channelId - Channel ID (e.g. '0')
 * @returns {Promise<{url: string, liveToken: string}|null>}
 */
async function getStreamUrl(deviceId, channelId = '0') {
  for (const streamId of [0, 1]) {
    try {
      const result = await bindDeviceLive(deviceId, channelId, streamId);

      const streams = result?.streams || [];
      const httpsStream = streams.find((s) => s.hls?.startsWith('https://'));
      const httpStream = streams.find((s) => s.hls?.startsWith('http://'));
      const chosen = httpsStream || httpStream;
      const hlsUrl = chosen?.hls || result?.hls || null;

      if (hlsUrl) {
        logger.info(`HLS URL obtained for ${deviceId}:${channelId}`, {
          streamId,
          protocol: hlsUrl.startsWith('https') ? 'HTTPS' : 'HTTP',
          url: hlsUrl.substring(0, 80) + '...',
        });
        return {
          url: hlsUrl,
          liveToken: chosen?.liveToken || result?.liveToken || null,
          coverUrl: chosen?.coverUrl || null,
        };
      }
    } catch (error) {
      if (error.code === 'LV1001') {
        // Stream session already active — retrieve existing URL
        logger.info(`Stream already active for ${deviceId}:${channelId}, fetching existing URL`);

        const existing = await getLiveStreamInfo(deviceId, channelId);
        if (existing?.url) return existing;

        // getLiveStreamInfo returned nothing — try unbind+rebind
        logger.info(`Attempting unbind+rebind for ${deviceId}:${channelId}`);
        try {
          const raw = await callImouApi('/getLiveStreamInfo', { deviceId, channelId });
          if (raw?.liveToken) {
            await unbindDeviceLive(raw.liveToken);
            const retry = await bindDeviceLive(deviceId, channelId, streamId);
            const retryUrl =
              retry?.streams?.find((s) => s.hls)?.hls ||
              retry?.hls || null;
            if (retryUrl) {
              return { url: retryUrl, liveToken: retry?.liveToken || null, coverUrl: null };
            }
          }
        } catch (retryErr) {
          logger.warn(`Unbind+rebind failed for ${deviceId}`, { error: retryErr.message });
        }

        // All strategies exhausted for this streamId — do NOT try SD if HD already active
        break;
      } else {
        logger.warn(`bindDeviceLive failed (streamId=${streamId}) for ${deviceId}`, {
          error: error.message,
          code: error.code,
        });
      }
    }
  }

  logger.warn(`Could not obtain HLS URL for ${deviceId}:${channelId}`);
  return null;
}

module.exports = {
  bindDeviceLive,
  unbindDeviceLive,
  getLiveStreamInfo,
  getStreamUrl,
};
