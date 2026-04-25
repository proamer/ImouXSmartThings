/**
 * Debug Script — Imou API Connectivity
 *
 * Run: node scripts/debug-imou.js
 *
 * Verbose debug to identify why Imou API calls fail.
 * Tests auth token, then device list, showing full request/response.
 */

require('dotenv').config();
const axios = require('axios');
const md5 = require('md5');

const APP_ID = process.env.IMOU_APP_ID;
const APP_SECRET = process.env.IMOU_APP_SECRET;
const API_BASE = process.env.IMOU_API_BASE || 'https://openapi.easy4ip.com/openapi';

console.log('════════════════════════════════════════════════');
console.log('  Imou API Debug Tool');
console.log('════════════════════════════════════════════════\n');

console.log('📋 Configuration:');
console.log(`   API Base:    ${API_BASE}`);
console.log(`   App ID:      ${APP_ID}`);
console.log(`   App Secret:  ${APP_SECRET ? APP_SECRET.substring(0, 8) + '...' + APP_SECRET.substring(APP_SECRET.length - 4) : '❌ MISSING'}`);
console.log(`   Secret Len:  ${APP_SECRET?.length || 0} chars`);
console.log();

async function debugAuth() {
  console.log('═══ Step 1: Access Token ═══\n');

  const time = Math.floor(Date.now() / 1000);
  const nonce = require('uuid').v4();
  const signRaw = `time:${time},nonce:${nonce},appSecret:${APP_SECRET}`;
  const sign = md5(signRaw);

  console.log('📤 Request:');
  console.log(`   URL:  POST ${API_BASE}/accessToken`);
  console.log(`   sign raw: "${signRaw}"`);
  console.log(`   sign md5: ${sign}`);
  console.log(`   time: ${time}`);
  console.log(`   nonce: ${nonce}`);

  const body = {
    system: {
      ver: '1.0',
      appId: APP_ID,
      sign,
      time,
      nonce,
    },
    id: '1',
    params: {},
  };

  console.log(`   body: ${JSON.stringify(body, null, 2)}`);

  try {
    const res = await axios.post(`${API_BASE}/accessToken`, body, {
      headers: { 'Content-Type': 'application/json' },
      timeout: 15000,
    });

    console.log('\n📥 Response:');
    console.log(`   Status: ${res.status}`);
    console.log(`   Data: ${JSON.stringify(res.data, null, 2)}`);

    const result = res.data?.result;
    if (result?.code === '0') {
      console.log('\n✅ Auth SUCCESS!');
      console.log(`   Token: ${result.data.accessToken.substring(0, 20)}...`);
      return result.data.accessToken;
    } else {
      console.log(`\n❌ Auth FAILED: code=${result?.code}, msg=${result?.msg}`);
      return null;
    }
  } catch (err) {
    console.log(`\n❌ Network error: ${err.message}`);
    if (err.response) {
      console.log(`   Status: ${err.response.status}`);
      console.log(`   Data: ${JSON.stringify(err.response.data)}`);
    }
    return null;
  }
}

async function debugDeviceList(token) {
  console.log('\n═══ Step 2: Device List ═══\n');

  const time = Math.floor(Date.now() / 1000);
  const sign = md5(`time:${time},appId:${APP_ID},appSecret:${APP_SECRET}`);

  const body = {
    system: {
      ver: '1.0',
      appId: APP_ID,
      sign,
      time,
    },
    params: {
      token,
      pageSize: '50',
      page: '1',
    },
    id: 'debug-test-001',
  };

  console.log('📤 Request:');
  console.log(`   URL:  POST ${API_BASE}/deviceOpenList`);
  console.log(`   body: ${JSON.stringify(body, null, 2)}`);

  try {
    const res = await axios.post(`${API_BASE}/deviceOpenList`, body, {
      headers: { 'Content-Type': 'application/json' },
      timeout: 15000,
    });

    console.log('\n📥 Response:');
    console.log(`   Status: ${res.status}`);
    console.log(`   Data: ${JSON.stringify(res.data, null, 2)}`);

    const result = res.data?.result;
    if (result?.code === '0') {
      const devices = result.data?.deviceList || [];
      console.log(`\n✅ Found ${devices.length} device(s):`);
      devices.forEach((d, i) => {
        console.log(`   [${i + 1}] name="${d.name}", id=${d.deviceId}, model=${d.deviceModel}, status=${d.status}`);
        console.log(`       channels: ${JSON.stringify(d.channels)}`);
      });
    } else {
      console.log(`\n❌ Device list FAILED: code=${result?.code}, msg=${result?.msg}`);
    }
  } catch (err) {
    console.log(`\n❌ Network error: ${err.message}`);
  }
}

async function main() {
  const token = await debugAuth();
  if (token) {
    await debugDeviceList(token);
  }

  console.log('\n════════════════════════════════════════════════');
  console.log('  Debug complete!');
  console.log('════════════════════════════════════════════════');
}

main().catch(console.error);
