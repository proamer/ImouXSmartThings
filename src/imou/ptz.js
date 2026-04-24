/**
 * Imou PTZ (Pan-Tilt-Zoom) Control
 *
 * Controls camera movement via `controlMovePTZ` and `controlLocationPTZ` APIs.
 *
 * Operations for controlMovePTZ:
 *   0 = Up, 1 = Down, 2 = Left, 3 = Right
 *   4 = LeftUp, 5 = LeftDown, 6 = RightUp, 7 = RightDown
 *   8 = Stop
 *
 * controlLocationPTZ: Absolute positioning (h, v, z coordinates)
 */

const { callImouApi } = require('./client');
const logger = require('../utils/logger');

/** PTZ direction constants */
const PTZ_DIRECTION = {
  UP: '0',
  DOWN: '1',
  LEFT: '2',
  RIGHT: '3',
  LEFT_UP: '4',
  LEFT_DOWN: '5',
  RIGHT_UP: '6',
  RIGHT_DOWN: '7',
  STOP: '8',
};

/**
 * Move the camera in a given direction.
 *
 * @param {string} deviceId - Imou device serial number
 * @param {string} channelId - Channel ID
 * @param {string} operation - Direction code (0-8), use PTZ_DIRECTION constants
 * @param {number} [duration=500] - Duration of movement in milliseconds
 * @returns {Promise<boolean>} true if successful
 */
async function movePTZ(deviceId, channelId = '0', operation, duration = 500) {
  try {
    await callImouApi('/controlMovePTZ', {
      deviceId,
      channelId,
      operation: String(operation),
      duration: String(duration),
    });

    logger.info(`PTZ move executed on device ${deviceId}`, {
      operation,
      duration,
    });

    return true;
  } catch (error) {
    logger.error(`PTZ move failed for device ${deviceId}`, {
      operation,
      error: error.message,
    });
    return false;
  }
}

/**
 * Move camera to an absolute position.
 *
 * @param {string} deviceId - Imou device serial number
 * @param {string} channelId - Channel ID
 * @param {number} h - Horizontal position (0-360 degrees)
 * @param {number} v - Vertical position (0-90 degrees)
 * @param {number} z - Zoom level (0-100)
 * @returns {Promise<boolean>} true if successful
 */
async function locationPTZ(deviceId, channelId = '0', h, v, z) {
  try {
    await callImouApi('/controlLocationPTZ', {
      deviceId,
      channelId,
      h: String(h),
      v: String(v),
      z: String(z),
    });

    logger.info(`PTZ location set on device ${deviceId}`, { h, v, z });

    return true;
  } catch (error) {
    logger.error(`PTZ location failed for device ${deviceId}`, {
      error: error.message,
    });
    return false;
  }
}

/**
 * Stop PTZ movement.
 *
 * @param {string} deviceId - Imou device serial number
 * @param {string} [channelId='0'] - Channel ID
 * @returns {Promise<boolean>}
 */
async function stopPTZ(deviceId, channelId = '0') {
  return movePTZ(deviceId, channelId, PTZ_DIRECTION.STOP);
}

/**
 * Get current PTZ position info.
 *
 * @param {string} deviceId - Imou device serial number
 * @param {string} [channelId='0'] - Channel ID
 * @returns {Promise<object|null>} PTZ position info
 */
async function getPTZInfo(deviceId, channelId = '0') {
  try {
    const data = await callImouApi('/devicePTZInfo', {
      deviceId,
      channelId,
    });
    return data;
  } catch (error) {
    logger.warn(`Failed to get PTZ info for ${deviceId}`, {
      error: error.message,
    });
    return null;
  }
}

module.exports = {
  PTZ_DIRECTION,
  movePTZ,
  locationPTZ,
  stopPTZ,
  getPTZInfo,
};
