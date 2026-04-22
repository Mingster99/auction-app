import { useState, useCallback, useRef } from 'react';
import {
  Room,
  RoomEvent,
  Track,
  VideoPresets,
  createLocalTracks,
} from 'livekit-client';

// ============================================================
// useLiveKit Hook — Replaces useAgora
// ============================================================
//
// KEY DIFFERENCES FROM AGORA:
// - No "client role" concept — permissions come from the token
// - Rooms auto-create when the first participant joins
// - Track subscription is automatic (no manual subscribe calls)
// - Event names are different but concepts are the same
// ============================================================

export const useLiveKit = () => {
  const roomRef = useRef(null);

  // State
  const [isJoined, setIsJoined] = useState(false);
  const [isPublishing, setIsPublishing] = useState(false);
  const [isMicMuted, setIsMicMuted] = useState(false);
  const [isCameraMuted, setIsCameraMuted] = useState(false);
  const [remoteVideoTrack, setRemoteVideoTrack] = useState(null);
  const [remoteAudioTrack, setRemoteAudioTrack] = useState(null);
  const [localVideoTrack, setLocalVideoTrack] = useState(null);
  const [localAudioTrack, setLocalAudioTrack] = useState(null);
  const [isHostPresent, setIsHostPresent] = useState(true);
  const [error, setError] = useState(null);

  // ── SETUP ROOM EVENT LISTENERS ──────────────────────────
  const setupListeners = useCallback((room) => {
    room.on(RoomEvent.TrackSubscribed, (track, publication, participant) => {
      console.log('📺 Track subscribed:', track.kind, 'from', participant.identity);

      if (track.kind === Track.Kind.Video) {
        setRemoteVideoTrack(track);
      }
      if (track.kind === Track.Kind.Audio) {
        setRemoteAudioTrack(track);
        const audioEl = track.attach();
        audioEl.muted = true;
        document.body.appendChild(audioEl);

        // Attempt autoplay — browsers block this without prior user interaction
        const tryPlay = () => {
          audioEl.muted = false;
          audioEl.play().catch(() => {
            // Autoplay blocked — unmute on first user click
            const resumeAudio = () => {
              audioEl.muted = false;
              audioEl.play().catch(() => {});
              document.removeEventListener('click', resumeAudio);
            };
            document.addEventListener('click', resumeAudio, { once: true });
          });
        };
        tryPlay();
      }
    });

    room.on(RoomEvent.TrackUnsubscribed, (track, publication, participant) => {
      console.log('🔇 Track unsubscribed:', track.kind, 'from', participant.identity);
      track.detach().forEach((el) => el.remove());

      if (track.kind === Track.Kind.Video) {
        setRemoteVideoTrack(null);
      }
      if (track.kind === Track.Kind.Audio) {
        setRemoteAudioTrack(null);
      }
    });

    room.on(RoomEvent.Disconnected, () => {
      console.log('🔌 Disconnected from room');
      setIsJoined(false);
      setIsPublishing(false);
      setRemoteVideoTrack(null);
      setRemoteAudioTrack(null);
    });

    room.on(RoomEvent.ParticipantConnected, (participant) => {
      console.log('👤 Participant connected:', participant.identity);
      if (participant.identity.startsWith('host_')) {
        setIsHostPresent(true);
      }
    });

    room.on(RoomEvent.ParticipantDisconnected, (participant) => {
      console.log('👤 Participant disconnected:', participant.identity);
      if (participant.identity.startsWith('host_')) {
        setIsHostPresent(false);
      }
    });

    room.on(RoomEvent.Reconnecting, () => {
      console.log('🔄 Reconnecting...');
    });

    room.on(RoomEvent.Reconnected, () => {
      console.log('✅ Reconnected!');
    });
  }, []);

  // ── JOIN AS HOST ────────────────────────────────────────
  const joinAsHost = useCallback(async (wsUrl, token) => {
    // Idempotent — if a room is already being created/connected, skip.
    // Prevents two concurrent sessions with the same identity, which LiveKit
    // resolves by kicking the older session.
    if (roomRef.current) {
      console.warn('⏭  joinAsHost ignored — room already exists');
      return;
    }
    try {
      console.log('🎥 Joining as host...');
      setError(null);

      const room = new Room({
        adaptiveStream: true,
        dynacast: true,
        videoCaptureDefaults: {
          resolution: VideoPresets.h720.resolution,
        },
      });

      roomRef.current = room;
      setupListeners(room);

      await room.connect(wsUrl, token);
      console.log('✅ Connected to room:', room.name);
      setIsJoined(true);

      // Try camera + mic
      try {
        const tracks = await createLocalTracks({
          audio: true,
          video: true,
        });

        for (const track of tracks) {
          await room.localParticipant.publishTrack(track);

          if (track.kind === Track.Kind.Video) {
            setLocalVideoTrack(track);
          }
          if (track.kind === Track.Kind.Audio) {
            setLocalAudioTrack(track);
          }
        }

        setIsPublishing(true);
        console.log('✅ Publishing video + audio');
      } catch (deviceError) {
        console.warn('⚠️ Camera/mic error, trying audio-only:', deviceError.message);

        // Fallback: audio-only
        try {
          const [audioTrack] = await createLocalTracks({
            audio: true,
            video: false,
          });
          await room.localParticipant.publishTrack(audioTrack);
          setLocalAudioTrack(audioTrack);
          setIsPublishing(true);
          console.log('✅ Publishing audio-only (no camera)');
        } catch (audioError) {
          console.warn('⚠️ No mic either, joined with no media:', audioError.message);
        }
      }
    } catch (err) {
      console.error('❌ Failed to join as host:', err);
      setError(err.message);
      throw err;
    }
  }, [setupListeners]);

  // ── JOIN AS VIEWER ──────────────────────────────────────
  const joinAsViewer = useCallback(async (wsUrl, token) => {
    // Idempotent — if a room is already being created/connected, skip.
    // Prevents a second session with the same viewer identity from kicking the first.
    if (roomRef.current) {
      console.warn('⏭  joinAsViewer ignored — room already exists');
      return;
    }
    try {
      console.log('👁️  Joining as viewer...');
      setError(null);

      const room = new Room({
        adaptiveStream: true,
        dynacast: true,
      });

      // Reserve the slot synchronously, before the async connect — otherwise
      // a concurrent caller could pass the guard above and create a second Room.
      roomRef.current = room;
      setupListeners(room);

      await room.connect(wsUrl, token);
      console.log('✅ Connected as viewer to room:', room.name);
      setIsJoined(true);

      // Seed host presence from participants already in the room
      const hostAlreadyPresent = [...room.remoteParticipants.values()]
        .some((p) => p.identity.startsWith('host_'));
      setIsHostPresent(hostAlreadyPresent);
    } catch (err) {
      console.error('❌ Failed to join as viewer:', err);
      // Release the slot so a retry can construct a fresh Room.
      roomRef.current = null;
      setError(err.message);
      throw err;
    }
  }, [setupListeners]);

  // ── LEAVE ROOM ──────────────────────────────────────────
  const leave = useCallback(async () => {
    try {
      const room = roomRef.current;
      if (room) {
        // Stop local tracks via the room's local participant (avoids stale closure)
        for (const pub of room.localParticipant.trackPublications.values()) {
          pub.track?.stop();
        }

        await room.disconnect(true);
        roomRef.current = null;
      }

      setIsJoined(false);
      setIsPublishing(false);
      setLocalVideoTrack(null);
      setLocalAudioTrack(null);
      setRemoteVideoTrack(null);
      setRemoteAudioTrack(null);
      setIsMicMuted(false);
      setIsCameraMuted(false);
      setIsHostPresent(true);

      console.log('👋 Left room');
    } catch (err) {
      console.error('Error leaving room:', err);
    }
  }, []);

  // ── TOGGLE MIC ──────────────────────────────────────────
  const toggleMic = useCallback(async () => {
    const room = roomRef.current;
    if (!room) return;

    try {
      await room.localParticipant.setMicrophoneEnabled(!isMicMuted ? false : true);
      setIsMicMuted(!isMicMuted);
      console.log(isMicMuted ? '🎤 Mic unmuted' : '🔇 Mic muted');
    } catch (err) {
      console.error('Error toggling mic:', err);
    }
  }, [isMicMuted]);

  // ── TOGGLE CAMERA ───────────────────────────────────────
  const toggleCamera = useCallback(async () => {
    const room = roomRef.current;
    if (!room) return;

    try {
      await room.localParticipant.setCameraEnabled(!isCameraMuted ? false : true);
      setIsCameraMuted(!isCameraMuted);
      console.log(isCameraMuted ? '📷 Camera on' : '📷 Camera off');
    } catch (err) {
      console.error('Error toggling camera:', err);
    }
  }, [isCameraMuted]);

  return {
    isJoined,
    isPublishing,
    isMicMuted,
    isCameraMuted,
    remoteVideoTrack,
    remoteAudioTrack,
    localVideoTrack,
    localAudioTrack,
    isHostPresent,
    error,
    joinAsHost,
    joinAsViewer,
    leave,
    toggleMic,
    toggleCamera,
  };
};
