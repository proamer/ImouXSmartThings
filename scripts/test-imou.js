/**
 * Test Script — Imou API Connection
 *
 * Run: node scripts/test-imou.js
 *
 * Tests basic connectivity to the Imou Open Platform:
 * 1. Fetches an access token
 * 2. Lists all devices
 * 3. Checks device online status (first device)
 */


require('dotenv').config();

const { getAccessToken } = require('../src/imou/auth');
const { listAllDevices, getDeviceOnline } = require('../src/imou/devices');
const logger = require('../src/utils/logger');

async function main() {
  console.log('═══════════════════════════════════════════');
  console.log('  Imou API Connection Test');
  console.log('═══════════════════════════════════════════\n');

  // 1. Test access token
  console.log('1️⃣  Fetching access token...');
  try {
    const token = await getAccessToken();
    console.log(`   ✅ Token obtained: ${token.substring(0, 20)}...`);
  } catch (error) {
    console.error(`   ❌ Failed: ${error.message}`);
    process.exit(1);
  }

  // 2. List devices
  console.log('\n2️⃣  Listing devices...');
  try {
    const devices = await listAllDevices();
    console.log(`   ✅ Found ${devices.length} device(s):`);
    devices.forEach((d, i) => {
      console.log(`   [${i + 1}] ${d.name || 'Unnamed'} (${d.deviceId}) — Model: ${d.deviceModel || 'N/A'}`);
    });

    // 3. Check first device online status
    if (devices.length > 0) {
      const firstDevice = devices[0];
      console.log(`\n3️⃣  Checking online status for "${firstDevice.name}"...`);
      const status = await getDeviceOnline(firstDevice.deviceId);
      const isOnline = status?.onLine === '1';
      console.log(`   ${isOnline ? '✅ Online' : '⚠️  Offline'}`);
    }
  } catch (error) {
    console.error(`   ❌ Failed: ${error.message}`);
  }

  console.log('\n═══════════════════════════════════════════');
  console.log('  Test complete!');
  console.log('═══════════════════════════════════════════');
}

main().catch(console.error);
