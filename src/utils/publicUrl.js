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

function buildLiveStreamProxyUrl(baseUrl, deviceId, channelId = '0') {
  if (!baseUrl) {
    return '';
  }

  const encodedDeviceId = encodeURIComponent(deviceId);
  const encodedChannelId = encodeURIComponent(channelId);
  const url = new URL(`/stream/${encodedDeviceId}/${encodedChannelId}/live.m3u8`, `${baseUrl}/`);
  url.searchParams.set('t', Date.now().toString());
  return url.toString();
}

function buildLiveSegmentProxyUrl(baseUrl, segmentUrl) {
  if (!baseUrl || !segmentUrl) {
    return '';
  }

  const url = new URL('/stream-segment', `${baseUrl}/`);
  url.searchParams.set('url', segmentUrl);
  return url.toString();
}

module.exports = {
  getPublicBaseUrl,
  buildSnapshotProxyUrl,
  buildLiveStreamProxyUrl,
  buildLiveSegmentProxyUrl,
};
