# 📂 File Placement Guide

Quick reference for where to place each Agora integration file in your project.

---

## Backend Files

### 1. Create Agora Service
**Location:** `backend/src/services/agoraService.js`
**Source:** `backend-agora-service.js`
**Purpose:** Generate Agora tokens for hosts and viewers

### 2. Create Streams Controller
**Location:** `backend/src/modules/streams/streams.controller.js`
**Source:** `backend-streams-controller.js`
**Purpose:** Handle stream creation, start, join, end

### 3. Update Streams Routes
**Location:** `backend/src/modules/streams/streams.routes.js`
**Source:** `backend-streams-routes.js`
**Purpose:** Define API endpoints for streams

### 4. Database Migration
**Location:** `backend/src/database/migrations/002_add_channel_name.sql`
**Source:** `002_add_channel_name.sql`
**Purpose:** Add channel_name field to streams table

---

## Frontend Files

### 1. Create Agora Hook
**Location:** `frontend/src/hooks/useAgora.js`
**Source:** `frontend-useAgora-hook.js`
**Purpose:** Custom React hook for Agora SDK

### 2. Create Host Page
**Location:** `frontend/src/pages/StreamHostPage.jsx`
**Source:** `frontend-StreamHost-component.jsx`
**Purpose:** Page for sellers to start and manage streams

### 3. Update Viewer Page
**Location:** `frontend/src/pages/LivestreamPage.jsx`
**Source:** `frontend-StreamViewer-component.jsx`
**Purpose:** Page for viewers to watch streams

### 4. Update Stream Service
**Location:** `frontend/src/services/streamService.js`
**Source:** `frontend-streamService-updated.js`
**Purpose:** API calls for stream operations

---

## Installation Commands

```bash
# Backend
cd backend
npm install agora-access-token

# Frontend
cd frontend
npm install agora-rtc-sdk-ng
```

---

## Environment Variables

### Backend (.env)
```env
AGORA_APP_ID=your_app_id_here
AGORA_APP_CERTIFICATE=
```

### Frontend (.env)
```env
REACT_APP_AGORA_APP_ID=your_app_id_here
```

---

## Route Update

Add to `frontend/src/App.jsx`:

```jsx
import StreamHostPage from './pages/StreamHostPage';

// Inside <Routes>:
<Route path="/stream/host" element={<StreamHostPage />} />
```

---

## Database Update

```bash
psql -d pokemon_auction -f backend/src/database/migrations/002_add_channel_name.sql
```

---

## Testing URLs

- **Start streaming:** http://localhost:3000/stream/host
- **Watch stream:** http://localhost:3000/livestream/[STREAM_ID]

---

All files are in the `agora-integration/` folder!
