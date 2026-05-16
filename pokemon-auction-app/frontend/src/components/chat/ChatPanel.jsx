import React, { useState, useEffect, useRef, useCallback } from 'react';
import api from '../../services/api';

function formatTimestamp(ts) {
  const date = new Date(ts);
  const secsAgo = Math.floor((Date.now() - date.getTime()) / 1000);
  if (secsAgo < 60) return `${secsAgo}s ago`;
  if (secsAgo < 3600) return `${Math.floor(secsAgo / 60)}m ago`;
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function ModerationMenu({ user, position, onSilence, onBan, onClose }) {
  const menuRef = useRef(null);

  useEffect(() => {
    const handler = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) onClose();
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [onClose]);

  const style = {
    position: 'fixed',
    top: Math.min(position.y, window.innerHeight - 220),
    left: Math.min(position.x, window.innerWidth - 180),
    zIndex: 9999,
  };

  return (
    <div
      ref={menuRef}
      style={style}
      className="bg-[#1a1f2e] border border-gray-700 rounded-xl shadow-2xl py-1 min-w-[172px]"
      onClick={(e) => e.stopPropagation()}
    >
      <p className="px-3 py-1.5 text-xs text-gray-500 border-b border-gray-800 mb-1 truncate">
        {user.username}
      </p>
      {[1, 5, 15, 60].map((min) => (
        <button
          key={min}
          onClick={() => { onSilence(user.userId, min); onClose(); }}
          className="w-full text-left px-3 py-2 text-sm text-yellow-400 hover:bg-yellow-600/10 transition-colors"
        >
          Silence {min} min
        </button>
      ))}
      <div className="border-t border-gray-800 mt-1 pt-1">
        <button
          onClick={() => { onBan(user.userId, user.username); onClose(); }}
          className="w-full text-left px-3 py-2 text-sm text-red-400 hover:bg-red-600/10 transition-colors"
        >
          Ban from chat
        </button>
      </div>
    </div>
  );
}

export function ChatPanel({
  streamId,
  messages,
  currentUserId,
  chatError,
  moderationStatus,
  connected,
  onSendMessage,
  onBanUser,
  onUnbanUser,
  onSilenceUser,
  isHost = false,
}) {
  const [input, setInput] = useState('');
  const [activeMenu, setActiveMenu] = useState(null);
  const [atBottom, setAtBottom] = useState(true);
  const [unread, setUnread] = useState(0);
  const [bannedUsers, setBannedUsers] = useState([]); // [{ userId, username }]
  const [showBans, setShowBans] = useState(false);
  const messagesEndRef = useRef(null);
  const containerRef = useRef(null);

  // Load existing bans from server on mount (host only)
  useEffect(() => {
    if (!isHost || !streamId) return;
    api.get(`/streams/${streamId}/bans`)
      .then((res) => setBannedUsers(res.data))
      .catch(() => {});
  }, [isHost, streamId]);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (atBottom) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
      setUnread(0);
    } else {
      setUnread((n) => n + 1);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messages.length]);

  const handleScroll = useCallback((e) => {
    const { scrollTop, scrollHeight, clientHeight } = e.currentTarget;
    const isAtBottom = scrollHeight - scrollTop - clientHeight < 60;
    setAtBottom(isAtBottom);
    if (isAtBottom) setUnread(0);
  }, []);

  const jumpToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    setAtBottom(true);
    setUnread(0);
  };

  const handleSend = () => {
    const trimmed = input.trim();
    if (!trimmed || !connected) return;
    onSendMessage(trimmed);
    setInput('');
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleUsernameClick = (e, msg) => {
    if (!isHost || msg.userId === currentUserId) return;
    e.stopPropagation();
    setActiveMenu({ userId: msg.userId, username: msg.username, x: e.clientX, y: e.clientY });
  };

  const handleBan = (userId, username) => {
    onBanUser(userId);
    setBannedUsers((prev) => {
      if (prev.some((u) => u.userId === userId)) return prev;
      return [...prev, { userId, username }];
    });
  };

  const handleUnban = (userId) => {
    onUnbanUser(userId);
    setBannedUsers((prev) => prev.filter((u) => u.userId !== userId));
  };

  const isMuted = moderationStatus?.isBanned || moderationStatus?.isSilenced;

  let inputPlaceholder = 'Say something...';
  if (!connected) inputPlaceholder = 'Reconnecting...';
  else if (moderationStatus?.isBanned) inputPlaceholder = 'You are banned from this chat';
  else if (moderationStatus?.isSilenced) {
    const exp = moderationStatus.silenceExpiresAt
      ? new Date(moderationStatus.silenceExpiresAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      : '';
    inputPlaceholder = exp ? `Silenced until ${exp}` : 'You are silenced';
  }

  return (
    <div className="bg-[#1a1f2e] rounded-2xl border border-gray-800 flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-800 flex-shrink-0">
        <h3 className="font-bold text-sm text-gray-400">CHAT</h3>
        <div className="flex items-center gap-2">
          {isHost && bannedUsers.length > 0 && (
            <button
              onClick={() => setShowBans((v) => !v)}
              className="text-xs text-red-400 hover:text-red-300 transition-colors"
            >
              {showBans ? 'Hide' : `Banned (${bannedUsers.length})`}
            </button>
          )}
          {!connected && (
            <span className="text-xs text-amber-400">Reconnecting...</span>
          )}
        </div>
      </div>

      {/* Banned users list (host only, collapsible) */}
      {isHost && showBans && bannedUsers.length > 0 && (
        <div className="border-b border-gray-800 px-3 py-2 space-y-1 max-h-32 overflow-y-auto flex-shrink-0">
          {bannedUsers.map((u) => (
            <div key={u.userId} className="flex items-center justify-between gap-2 py-1">
              <span className="text-xs text-gray-300 truncate">{u.username}</span>
              <button
                onClick={() => handleUnban(u.userId)}
                className="text-xs text-violet-400 hover:text-violet-300 whitespace-nowrap transition-colors"
              >
                Unban
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Message list */}
      <div
        ref={containerRef}
        onScroll={handleScroll}
        className="overflow-y-auto px-3 py-2 space-y-1 relative"
        style={{ height: '200px' }}
      >
        {messages.length === 0 && (
          <p className="text-gray-600 text-xs text-center pt-6">No messages yet. Say hi!</p>
        )}
        {messages.map((msg, i) => {
          const isOwn = msg.userId === currentUserId;
          const isClickable = isHost && !isOwn;
          return (
            <div key={msg.id ?? `${msg.userId}-${i}`} className="flex items-start gap-1.5 group">
              <button
                onClick={(e) => handleUsernameClick(e, msg)}
                className={`text-xs font-bold flex-shrink-0 mt-0.5 leading-4 ${
                  isOwn
                    ? 'text-violet-400'
                    : isClickable
                      ? 'text-gray-300 hover:text-white cursor-pointer'
                      : 'text-gray-400 cursor-default'
                }`}
              >
                {msg.username}
              </button>
              <span className="text-xs text-gray-300 leading-4 break-words min-w-0 flex-1">
                {msg.message}
              </span>
              <span className="text-gray-700 text-xs flex-shrink-0 mt-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                {formatTimestamp(msg.timestamp)}
              </span>
            </div>
          );
        })}
        <div ref={messagesEndRef} />
      </div>

      {/* Jump to bottom badge */}
      {!atBottom && unread > 0 && (
        <button
          onClick={jumpToBottom}
          className="mx-3 mb-1 text-xs bg-violet-600/80 hover:bg-violet-600 text-white py-1 rounded-lg transition-colors"
        >
          {unread} new message{unread !== 1 ? 's' : ''} ↓
        </button>
      )}

      {/* Chat error banner */}
      {chatError && (
        <div className="mx-3 mb-1 px-3 py-1.5 bg-red-600/20 border border-red-600/30 rounded-lg">
          <p className="text-red-400 text-xs">{chatError.message}</p>
        </div>
      )}

      {/* Input bar */}
      <div className="flex gap-2 px-3 py-2 border-t border-gray-800 flex-shrink-0">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={!connected || isMuted}
          placeholder={inputPlaceholder}
          maxLength={500}
          className="flex-1 bg-gray-900 border border-gray-700 rounded-xl px-3 py-2 text-white text-xs placeholder-gray-600 focus:border-violet-500 focus:ring-1 focus:ring-violet-500/20 outline-none disabled:opacity-50 disabled:cursor-not-allowed"
        />
        <button
          onClick={handleSend}
          disabled={!input.trim() || !connected || isMuted}
          className="bg-violet-600 hover:bg-violet-700 disabled:opacity-40 disabled:cursor-not-allowed text-white text-xs font-bold px-3 py-2 rounded-xl transition-colors whitespace-nowrap"
        >
          Send
        </button>
      </div>

      {/* Moderation context menu */}
      {activeMenu && (
        <ModerationMenu
          user={activeMenu}
          position={{ x: activeMenu.x, y: activeMenu.y }}
          onSilence={onSilenceUser}
          onBan={handleBan}
          onClose={() => setActiveMenu(null)}
        />
      )}
    </div>
  );
}
