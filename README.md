# 📷 ImouXSmartThings — Webhook Connector

SmartThings Schema Connector ที่เชื่อมกล้อง **Imou** เข้ากับ **Samsung SmartThings** ผ่าน Cloud-to-Cloud integration

## Architecture

```
┌──────────────────┐         ┌─────────────────────┐         ┌──────────────────┐
│  SmartThings     │         │  Webhook Server     │         │  Imou Open API   │
│  Cloud           │◄───────►│  (this project)     │◄───────►│  (cameras)       │
│                  │  HTTPS  │                     │  HTTPS  │                  │
│  • Discovery     │         │  • Express.js       │         │  • accessToken   │
│  • StateRefresh  │         │  • OAuth2           │         │  • deviceList    │
│  • Commands      │         │  • Webhook Handler  │         │  • snapshot      │
│                  │         │                     │         │  • live stream   │
│                  │         │                     │         │  • PTZ control   │
└──────────────────┘         └─────────────────────┘         └──────────────────┘
```

## Features

| Feature | SmartThings Capability | Imou API |
|---|---|---|
| 🔘 เปิด/ปิดกล้อง | `st.switch` | `setDeviceCameraStatus` |
| 📸 ถ่าย Snapshot | `st.imageCapture` | `setDeviceSnap` |
| 📹 สถานะกล้อง | `st.videoCamera` | `deviceOnline` |
| 🔃 Refresh สถานะ | `st.refresh` | Re-query all |
| 🕹️ PTZ Control | `ptzControl` (custom) | `controlMovePTZ` |
| 📍 PTZ Position | `ptzPosition` (custom) | `controlLocationPTZ` |
| 📺 Live Stream | `st.videoStream` | `getLiveStreamInfo` |

## Quick Start

### 1. Prerequisites

- **Node.js** 18+ (LTS recommended)
- **Imou Developer Account** — [Register here](https://open.imoulife.com/)
- **SmartThings Developer Account** — [Register here](https://developer.smartthings.com/)
- **ngrok** (for development) — [Download](https://ngrok.com/)

### 2. Setup

```bash
# Clone the repo
git clone <repo-url>
cd ImouXSmartThings

# Install dependencies
npm install

# Copy environment template
cp .env.example .env

# Edit .env with your credentials
# (IMOU_APP_ID, IMOU_APP_SECRET, ST_CLIENT_ID, ST_CLIENT_SECRET)
```

### 3. Run

```bash
# Development (auto-reload)
npm run dev

# Production
npm start
```

### 4. Test

```bash
# Test Imou API connection
npm run test:imou

# Test webhook endpoints (server must be running)
npm run test:webhook
```

### 5. Expose with ngrok (for SmartThings)

```bash
ngrok http 3000
```

Then use the ngrok HTTPS URL as your webhook URL in the [SmartThings Developer Workspace](https://developer.smartthings.com/).

## SmartThings Developer Workspace Setup

1. Go to [SmartThings Developer Workspace](https://developer.smartthings.com/)
2. Create a new project → **Schema Connector**
3. Set the following URLs:
   - **Webhook URL**: `https://<your-ngrok-url>/smartthings`
   - **OAuth Authorization URL**: `https://<your-ngrok-url>/oauth/authorize`
   - **OAuth Token URL**: `https://<your-ngrok-url>/oauth/token`
4. Copy `Client ID` and `Client Secret` to your `.env`

## API Endpoints

| Method | Path | Description |
|---|---|---|
| POST | `/smartthings` | SmartThings webhook (all interaction types) |
| GET | `/oauth/authorize` | OAuth2 authorization page |
| POST | `/oauth/token` | OAuth2 token exchange |
| GET | `/health` | Health check |
| GET | `/` | Service info |

## Project Structure

```
src/
├── index.js                 # Express server entry point
├── config.js                # Environment configuration
├── imou/
│   ├── auth.js              # Imou access token management
│   ├── client.js            # Imou API HTTP client
│   ├── devices.js           # Device listing & status
│   ├── snapshot.js           # Snapshot capture
│   ├── live.js              # Live stream management
│   └── ptz.js               # PTZ movement control
├── smartthings/
│   ├── webhook.js           # Webhook router
│   ├── discovery.js         # Device discovery handler
│   ├── stateRefresh.js      # State refresh handler
│   ├── command.js           # Command handler
│   └── oauth.js             # OAuth2 placeholder
└── utils/
    ├── logger.js            # Structured logging
    └── crypto.js            # Sign generation
```

## Environment Variables

| Variable | Required | Description |
|---|---|---|
| `PORT` | No | Server port (default: 3000) |
| `IMOU_APP_ID` | **Yes** | Imou Open Platform App ID |
| `IMOU_APP_SECRET` | **Yes** | Imou Open Platform App Secret |
| `IMOU_API_BASE` | No | Imou API base URL (default: global) |
| `ST_CLIENT_ID` | **Yes** | SmartThings client ID |
| `ST_CLIENT_SECRET` | **Yes** | SmartThings client secret |

## License

MIT
