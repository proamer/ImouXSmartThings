const config = require('../config');

function getDeviceHandlerType() {
  return config.smartthings.deviceHandlerType;
}

function isBuiltInRtspProfile() {
  return getDeviceHandlerType().startsWith('c2c-camera-rtsp');
}

function supportsVideoCamera() {
  return !isBuiltInRtspProfile();
}

function supportsSwitch() {
  return getDeviceHandlerType() === 'c2c-camera-rtsp-1';
}

module.exports = {
  getDeviceHandlerType,
  supportsSwitch,
  supportsVideoCamera,
};
