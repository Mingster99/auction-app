# 🎥 Agora Integration Guide

Complete guide to integrate Agora livestreaming into your Pokémon auction app.

---

## 📋 What You'll Achieve

After following this guide:
- ✅ Sellers can start livestreams with video/audio
- ✅ Viewers can watch livestreams in real-time
- ✅ Host can control mic and camera
- ✅ Low latency streaming (< 400ms)
- ✅ Free tier (10,000 minutes/month)

---

## 🚀 Step 1: Get Agora Credentials

### Sign Up

1. Go to https://console.agora.io/
2. Click **Sign Up** (free account)
3. Verify your email

### Create Project

1. Click **Project Management** in sidebar
2. Click **Create** button
3. Fill in:
   - **Project Name:** `Pokemon Auction App`
   - **Use Case:** Choose "Social" or "Live Streaming"
   - **Authentication:** Select **Testing mode** (for development)
4. Click **Submit**

### Get Your App ID

After creating the project, you'll see:
- **App ID** - A 32-character string (e.g., `a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6`)
- Copy this! You'll need it multiple times

**Note:** For production, you'll need to enable **Secured mode** and get an App Certificate. For now, Testing mode is fine.

---

## 📦 Step 2: Install Dependencies

### Backend

```bash
cd backend
npm install agora-access-token
```

### Frontend

```bash
cd frontend
npm install agora-rtc-sdk-ng
```

---

## ⚙️ Step 3: Configure Environment Variables

### Backend .env

Add to `backend/.env`:

```env
# Agora Configuration
AGORA_APP_ID=your_app_id_here
AGORA_APP_CERTIFICATE=  # Leave empty for testing mode
```

Replace `your_app_id_here` with your actual App ID from Agora Console.

### Frontend .env

Add to `frontend/.env`:

```env
# Agora Configuration
REACT_APP_AGORA_APP_ID=your_app_id_here
```

Use the **same App ID** as backend.

---

## 🗄️ Step 4: Update Database

Run the migration to add `channel_name` field:

```bash
psql -d pokemon_auction -f backend/src/database/migrations/002_add_channel_name.sql
```

Or manually:

```sql
ALTER TABLE streams ADD COLUMN IF NOT EXISTS channel_name VARCHAR(255) UNIQUE;
```

---

## 🔧 Step 5: Add Backend Files

### Create Agora Service

Create `backend/src/services/agoraService.js`:

**Copy the code from:** `backend-agora-service.js` (in the files I provided)

This file handles:
- Generating Agora tokens
- Creating host tokens (for broadcasting)
- Creating viewer tokens (for watching)

### Update Streams Controller

Replace `backend/src/modules/streams/streams.controller.js`:

**Copy the code from:** `backend-streams-controller.js`

This adds:
- Create stream
- Start stream (get Agora credentials)
- Join stream (get viewer credentials)
- End stream

### Update Streams Routes

Replace `backend/src/modules/streams/streams.routes.js`:

**Copy the code from:** `backend-streams-routes.js`

---

## 🎨 Step 6: Add Frontend Files

### Create Agora Hook

Create `frontend/src/hooks/useAgora.js`:

**Copy the code from:** `frontend-useAgora-hook.js`

This custom hook handles:
- Joining as host (with camera/mic)
- Joining as viewer (watch only)
- Managing local and remote video tracks
- Mute/unmute controls

### Create Host Component

Create `frontend/src/pages/StreamHostPage.jsx`:

**Copy the code from:** `frontend-StreamHost-component.jsx`

This page allows sellers to:
- Create a new stream
- Go live with video/audio
- Control mic and camera
- End the stream

### Update Viewer Component

Replace `frontend/src/pages/LivestreamPage.jsx`:

**Copy the code from:** `frontend-StreamViewer-component.jsx`

This page allows viewers to:
- Watch live video
- See stream info
- Join/leave streams

### Update Stream Service

Replace `frontend/src/services/streamService.js`:

**Copy the code from:** `frontend-streamService-updated.js`

---

## 🔌 Step 7: Update App Routes

Edit `frontend/src/App.jsx` to add the host page:

```jsx
import StreamHostPage from './pages/StreamHostPage';

// Inside <Routes>:
<Route path="/stream/host" element={<StreamHostPage />} />
```

---

## 🎨 Step 8: Add Basic Styles

Add to `frontend/src/styles/index.css`:

```css
/* Livestream Styles */
.stream-host-page,
.stream-viewer-page {
  padding: 20px;
}

.video-preview,
.video-player-container {
  position: relative;
  width: 100%;
  max-width: 1280px;
  aspect-ratio: 16 / 9;
  background: #000;
  border-radius: 8px;
  overflow: hidden;
  margin-bottom: 20px;
}

.video-player {
  width: 100%;
  height: 100%;
}

.video-placeholder {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100%;
  color: white;
}

.stream-controls {
  display: flex;
  gap: 10px;
  margin-top: 20px;
}

.live-badge {
  background: red;
  color: white;
  padding: 4px 8px;
  border-radius: 4px;
  font-weight: bold;
}

.stream-container {
  display: grid;
  grid-template-columns: 1fr 300px;
  gap: 20px;
}

.stream-sidebar {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

@media (max-width: 768px) {
  .stream-container {
    grid-template-columns: 1fr;
  }
}
```

---

## ✅ Step 9: Test It!

### Start Your Servers

```bash
# Terminal 1 - Backend
cd backend
npm run dev

# Terminal 2 - Frontend
cd frontend
npm start
```

### Test Flow

1. **Create an account and login**
   - Go to http://localhost:3000/signup
   - Create test account

2. **Start a stream (as host)**
   - Go to http://localhost:3000/stream/host
   - Fill in stream title
   - Click "Create Stream"
   - Click "🔴 Go Live"
   - Allow camera/microphone access
   - You should see yourself on video!

3. **Watch stream (as viewer)**
   - Open **new incognito window** (or different browser)
   - Login with a different account
   - Go to http://localhost:3000/livestream/[STREAM_ID]
   - Click "Join Stream"
   - You should see the host's video!

---

## 🐛 Troubleshooting

### "Agora App ID not configured"

**Problem:** Environment variable not set

**Fix:**
```bash
# Check .env files exist
ls backend/.env
ls frontend/.env

# Verify content
cat backend/.env | grep AGORA
cat frontend/.env | grep AGORA
```

### "Camera/microphone access denied"

**Problem:** Browser blocked permissions

**Fix:**
- Click the camera icon in browser address bar
- Allow camera and microphone
- Refresh page

### "Failed to join channel"

**Problem:** Agora credentials incorrect or network issue

**Fix:**
1. Verify App ID is correct (32 characters)
2. Check browser console for detailed errors
3. Ensure you're using Testing mode (not Secured mode yet)

### "Video not showing"

**Problem:** Video track not playing

**Fix:**
1. Check browser console for errors
2. Verify `videoRef` is attached to DOM element
3. Try different browser (Chrome works best)

### "Remote user not appearing"

**Problem:** Viewer joined but can't see host

**Fix:**
1. Verify host is actually publishing (check console logs)
2. Check both users are in same channel
3. Wait 2-3 seconds for connection

---

## 📊 Verify Integration Works

### Backend Checks

```bash
# Test create stream endpoint
curl -X POST http://localhost:5000/api/streams \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -d '{"title":"Test Stream"}'

# Should return stream object with channel_name
```

### Frontend Checks

1. Open browser console (F12)
2. Look for these logs:
   - ✅ "Joined channel as host: stream_X_Y"
   - ✅ "Published local tracks"
   - ✅ "Subscribed to user: 123"

---

## 🎯 What You've Built

After integration, you have:

- ✅ **Host page** - Sellers start streams with video/audio
- ✅ **Viewer page** - Users watch streams in real-time
- ✅ **Controls** - Mute/unmute mic and camera
- ✅ **Low latency** - Sub-400ms delay
- ✅ **Scalable** - Agora handles infrastructure

---

## 🚀 Next Steps

Now that livestreaming works, add:

1. **Chat integration** - Real-time messages during stream
2. **Current card display** - Show which card is being auctioned
3. **Bidding panel** - Place bids while watching
4. **Stream scheduling** - Let sellers schedule streams in advance
5. **Recording** - Save streams for replay

---

## 📚 Additional Resources

- **Agora Docs:** https://docs.agora.io/en/
- **React SDK Guide:** https://docs.agora.io/en/video-calling/get-started/get-started-sdk
- **API Reference:** https://api-ref.agora.io/en/video-sdk/web/4.x/

---

## 💡 Cost Estimate

**Agora Free Tier:**
- 10,000 minutes/month free
- After that: ~$0.99 per 1,000 minutes

**Example usage:**
- 50 streams/month × 60 minutes = 3,000 minutes
- **Cost: $0** (within free tier)

---

## ✅ Integration Checklist

- [ ] Agora account created
- [ ] App ID obtained
- [ ] Environment variables set
- [ ] Dependencies installed
- [ ] Database migration run
- [ ] Backend files added
- [ ] Frontend files added
- [ ] Routes updated
- [ ] Styles added
- [ ] Tested host streaming
- [ ] Tested viewer watching
- [ ] Camera/mic controls work

---

**🎉 You're done!** Your app now has real livestreaming capabilities!

**Questions?** Common issues and their solutions are in the Troubleshooting section above.
