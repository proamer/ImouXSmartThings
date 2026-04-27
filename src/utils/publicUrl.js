const config = require('../config');

function getPublicBaseUrl(req) {
  if (config.publicBaseUrl) {
    return config.publicBaseUrl.replace(/\/+$/, '');
  }

  const forwardedProto = req?.headers?.['x-forwarded-proto'];
  const forwardedHost = req?.headers?.['x-forwarded-host'];
  const host = forwardedHost || req?.get?.('host');

  if (!host) {
    return '';
  }

  const protocol = forwardedProto || req?.protocol || 'https';
  return `${protocol}://${host}`;
}

function buildSnapshotProxyUrl(baseUrl, deviceId, channelId = '0') {
  if (!baseUrl) {
    return '';
  }

  const encodedDeviceId = encodeURIComponent(deviceId);
  const encodedChannelId = encodeURIComponent(channelId);
  const url = new URL(`/snapshot/${encodedDeviceId}/${encodedChannelId}`, `${baseUrl}/`);
  url.searchParams.set('t', Date.now().toString());
  return url.toString();
}

module.exports = {
  getPublicBaseUrl,
  buildSnapshotProxyUrl,
};
