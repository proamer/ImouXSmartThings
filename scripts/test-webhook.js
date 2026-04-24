/**
 * Test Script — SmartThings Webhook
 *
 * Run: node scripts/test-webhook.js
 *
 * Sends mock SmartThings Schema requests to the local webhook server.
 * Make sure the server is running first: npm run dev
 */

const axios = require('axios');

const BASE_URL = process.env.WEBHOOK_URL || 'http://localhost:3000';

async function testDiscovery() {
  console.log('\n1️⃣  Testing discoveryRequest...');

  const payload = {
    headers: {
      schema: 'st-schema',
      version: '1.0',
      interactionType: 'discoveryRequest',
      requestId: 'test-discovery-001',
    },
    authentication: {
      tokenType: 'Bearer',
      token: 'test-token',
    },
  };

  try {
    const response = await axios.post(`${BASE_URL}/smartthings`, payload);
    const data = response.data;
    console.log(`   ✅ Response: ${data.headers.interactionType}`);
    console.log(`   📷 Devices found: ${data.devices?.length || 0}`);
    if (data.devices?.length > 0) {
      data.devices.forEach((d) => {
        console.log(`      — ${d.friendlyName} (${d.externalDeviceId})`);
      });
    }
  } catch (error) {
    console.error(`   ❌ Failed: ${error.message}`);
  }
}

async function testStateRefresh() {
  console.log('\n2️⃣  Testing stateRefreshRequest...');

  // First discover devices to get IDs
  let deviceId;
  try {
    const discResp = await axios.post(`${BASE_URL}/smartthings`, {
      headers: {
        schema: 'st-schema',
        version: '1.0',
        interactionType: 'discoveryRequest',
        requestId: 'test-pre-refresh',
      },
      authentication: { tokenType: 'Bearer', token: 'test-token' },
    });
    deviceId = discResp.data.devices?.[0]?.externalDeviceId;
  } catch (e) {}

  if (!deviceId) {
    console.log('   ⚠️  No devices found, using mock device ID');
    deviceId = 'imou-MOCK123456-0';
  }

  const payload = {
    headers: {
      schema: 'st-schema',
      version: '1.0',
      interactionType: 'stateRefreshRequest',
      requestId: 'test-refresh-001',
    },
    authentication: {
      tokenType: 'Bearer',
      token: 'test-token',
    },
    devices: [{ externalDeviceId: deviceId }],
  };

  try {
    const response = await axios.post(`${BASE_URL}/smartthings`, payload);
    const data = response.data;
    console.log(`   ✅ Response: ${data.headers.interactionType}`);
    console.log(`   📊 Device states: ${data.deviceState?.length || 0}`);
    if (data.deviceState?.length > 0) {
      data.deviceState[0].states?.forEach((s) => {
        console.log(`      — ${s.capability}.${s.attribute} = ${JSON.stringify(s.value)}`);
      });
    }
  } catch (error) {
    console.error(`   ❌ Failed: ${error.message}`);
  }
}

async function testCommand() {
  console.log('\n3️⃣  Testing commandRequest (imageCapture)...');

  const payload = {
    headers: {
      schema: 'st-schema',
      version: '1.0',
      interactionType: 'commandRequest',
      requestId: 'test-command-001',
    },
    authentication: {
      tokenType: 'Bearer',
      token: 'test-token',
    },
    devices: [
      {
        externalDeviceId: 'imou-MOCK123456-0',
        commands: [
          {
            component: 'main',
            capability: 'st.imageCapture',
            command: 'take',
            arguments: [],
          },
        ],
      },
    ],
  };

  try {
    const response = await axios.post(`${BASE_URL}/smartthings`, payload);
    const data = response.data;
    console.log(`   ✅ Response: ${data.headers.interactionType}`);
    console.log(`   📊 Updated states: ${data.deviceState?.length || 0}`);
  } catch (error) {
    console.error(`   ❌ Failed: ${error.message}`);
  }
}

async function testHealth() {
  console.log('\n4️⃣  Testing health endpoint...');
  try {
    const response = await axios.get(`${BASE_URL}/health`);
    console.log(`   ✅ Status: ${response.data.status}`);
    console.log(`   ⏱️  Uptime: ${Math.round(response.data.uptime)}s`);
  } catch (error) {
    console.error(`   ❌ Failed: ${error.message}`);
  }
}

async function main() {
  console.log('═══════════════════════════════════════════');
  console.log('  SmartThings Webhook Test');
  console.log('═══════════════════════════════════════════');
  console.log(`  Target: ${BASE_URL}`);

  await testHealth();
  await testDiscovery();
  await testStateRefresh();
  await testCommand();

  console.log('\n═══════════════════════════════════════════');
  console.log('  Test complete!');
  console.log('═══════════════════════════════════════════');
}

main().catch(console.error);
