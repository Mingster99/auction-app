# Agora integration session changes (2026-03-03)

This document summarizes the changes made during the debugging/integration session and the reasoning behind each change.

## 1) Added stream layout CSS + replaced `.live-badge`

- **File**: `frontend/src/styles/index.css`
- **Change**:
  - Inserted the stream layout classes from your guide inside `@layer components`.
  - **Replaced** the pre-existing Tailwind-based `.live-badge` with the guide’s CSS version.
- **Why**:
  - You asked where to place the snippet; `@layer components` is the correct section for reusable class styles.
  - You explicitly wanted the new `.live-badge` to override/replace the old one (to avoid conflicting definitions).

## 2) Fixed host “share link” so it uses the real stream id

- **File**: `frontend/src/pages/StreamHostPage.jsx`
- **Change**:
  - Replaced the hard-coded link text (`http://localhost:3000/livestream/{streamId}`) with:
    - `` `${window.location.origin}/livestream/${streamId}` ``
- **Why**:
  - The previous link could be copied as a literal string with braces (or could be wrong in non-local environments).
  - Using `window.location.origin` ensures the link stays correct regardless of host/port.
- **Bug it caused** (before fix):
  - Viewer attempted to load `/livestream/{streamId}` → backend received an invalid id → “stream not found”.

## 3) Fixed viewer route param mismatch (`undefined` stream id)

- **File**: `frontend/src/pages/LivestreamPage.jsx`
- **Change**:
  - Route is configured as `/livestream/:id`, but the page was reading `streamId` from `useParams()`.
  - Updated to read `{ id }` and use it as `streamId`.
- **Why**:
  - In React Router, the param name must match the `:paramName` used in the route definition.
- **Bug it caused** (before fix):
  - Requests like `GET /api/streams/undefined` → server errors and the UI displayed “Stream not found or no longer available”.

## 4) Made `POST /api/streams/:id/start` idempotent (re-join friendly)

- **File**: `backend/src/modules/streams/streams.controller.js`
- **Change**:
  - Previously: if a stream was already `live`, `startStream` returned **400** (“Stream is already live”).
  - Now: `startStream` always returns a host token; it only flips the DB status to `live` if it wasn’t already.
- **Why**:
  - If the host fails to join Agora on first attempt (device issues, refresh, etc.), the DB might still say `live`.
  - Idempotent “start” lets the host re-request credentials and rejoin without needing manual DB surgery.

## 5) Auto-resume host view when you already have a live stream

- **File**: `frontend/src/pages/StreamHostPage.jsx`
- **Change**:
  - Added a load-time check that fetches active streams and, if the logged-in user appears to be the host of a live stream, sets:
    - `streamId`, `streamTitle`, and `isLive`
  - This makes `/stream/host` show the live host UI instead of forcing “Create stream” again.
- **Why**:
  - You reported being stuck because the backend prevents creating a second stream when a `scheduled`/`live` one exists.
  - Without a “resume” flow, you can end up locked out of your own stream UI after a failed join or refresh.
- **Note**:
  - The current implementation matches the host by `host_name === user.username` because `/streams/active` returns `host_name` but not `host_id` in the response payload.

## 6) Allowed host to join even if camera/mic devices are missing

- **File**: `frontend/src/hooks/useAgora.js`
- **Change**:
  - `joinAsHost` used to fail hard if `createMicrophoneAndCameraTracks()` threw `DEVICE_NOT_FOUND`.
  - Updated flow:
    - Join the channel first.
    - Try to create mic+camera tracks and publish.
    - If that fails, fall back to **audio-only** using `createMicrophoneAudioTrack()` and publish it.
    - If that also fails, continue joined but with **no local media**.
  - `isPublishing` now reflects whether any track exists.
- **Why**:
  - You hit: `AgoraRTCError DEVICE_NOT_FOUND`.
  - Without fallbacks, a missing camera could prevent you from using an available microphone.
  - With fallbacks, “Go Live” can still succeed as audio-only (or at least not block the UI), and mic toggling can work when a mic track exists.

## 7) Clarified what “Connected: No” means in host UI

- **Files involved**:
  - `frontend/src/pages/StreamHostPage.jsx`
  - `frontend/src/hooks/useAgora.js`
- **Concept**:
  - DB status `live` means “the stream is live in the app database”.
  - `Connected: Yes/No` is driven by Agora (`isJoined`) and means “this browser tab has successfully joined the Agora channel”.
- **Why it matters**:
  - After resuming from DB state, you can be “live” in DB but not joined in Agora until you (re)join in the current tab.

## Practical takeaways (what you learned)

- **Route param names must match**:
  - `/livestream/:id` → `useParams()` provides `{ id }`, not `{ streamId }`.
- **Avoid hard-coded URLs**:
  - Prefer `window.location.origin` and interpolate real ids.
- **Make key endpoints idempotent**:
  - It makes re-entry and retry flows much easier (especially for realtime apps).
- **Device availability is not guaranteed**:
  - Add mic-only / no-media fallbacks so “Go Live” doesn’t depend on a camera existing.

## Current limitations / next improvements (optional)

- **Better host matching**:
  - Change `/api/streams/active` to also return `host_id`, then match `stream.host_id === user.id` instead of comparing usernames.
- **Resume join automatically**:
  - When resuming a live stream in `StreamHostPage.jsx`, optionally call `startStream(streamId)` to get fresh credentials and attempt to rejoin Agora automatically.
- **Viewer placeholder messaging**:
  - If host is audio-only, change “Waiting for host to start broadcasting...” to something like “Host is live (audio-only).”

