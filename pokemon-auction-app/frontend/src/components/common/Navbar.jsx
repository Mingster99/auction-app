import React, { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

// ============================================================
// NAVBAR COMPONENT
// ============================================================
// This component appears at the TOP of every page.
// It's rendered once in App.jsx, outside the page routes,
// so it stays consistent no matter which page you're on.
//
// useLocation() tells us what page we're currently on,
// so we can highlight the active nav link.
// ============================================================

function Navbar() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const { user, isAuthenticated, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation(); // Gets current URL path

  const handleLogout = async () => {
    try {
      await logout();
      navigate('/login');
    } catch (err) {
      console.error('Logout failed:', err);
    }
  };

  // Helper: is this link the current page?
  const isActive = (path) => location.pathname === path;

  return (
    <nav className="sticky top-0 z-50 bg-gray-950/90 backdrop-blur-md border-b border-gray-800/50">
      <div className="max-w-7xl mx-auto px-6">
        <div className="flex items-center justify-between h-16">

          {/* ── LOGO ── */}
          <Link
            to="/"
            className="font-black text-xl bg-gradient-to-r from-violet-400 to-blue-400 bg-clip-text text-transparent hover:opacity-80 transition-opacity"
          >
            PokéAuctions
          </Link>

          {/* ── DESKTOP NAV LINKS ── */}
          <div className="hidden md:flex items-center gap-1">
            {[
              { to: '/', label: 'Home' },
              { to: '/cards', label: 'Browse Cards' },
              { to: '/streams', label: 'Live Streams' },
            ].map((link) => (
              <Link
                key={link.to}
                to={link.to}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                  isActive(link.to)
                    ? 'text-white bg-gray-800'           // Active page
                    : 'text-gray-400 hover:text-white hover:bg-gray-800/50'  // Inactive
                }`}
              >
                {link.label}
              </Link>
            ))}
          </div>

          {/* ── RIGHT SIDE: Auth buttons or user menu ── */}
          <div className="hidden md:flex items-center gap-3">
            {isAuthenticated ? (
              <>
                {/* List a card button */}
                <Link
                  to="/cards/new"
                  className="text-sm font-medium text-gray-300 hover:text-white transition-colors"
                >
                  + List Card
                </Link>

                {/* Go live button */}
                <Link
                  to="/stream/host"
                  className="flex items-center gap-1.5 bg-red-600/20 hover:bg-red-600/30 border border-red-500/30 text-red-400 px-3 py-1.5 rounded-full text-sm font-medium transition-all"
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
                  Go Live
                </Link>

                {/* User dropdown */}
                <div className="relative group">
                  {/* User avatar button */}
                  <button className="flex items-center gap-2 bg-gray-800 hover:bg-gray-700 border border-gray-700 px-3 py-2 rounded-xl transition-all">
                    {/* Avatar circle with initial */}
                    <div className="w-6 h-6 rounded-full bg-violet-600 flex items-center justify-center text-xs font-bold text-white">
                      {user?.username?.[0]?.toUpperCase() || '?'}
                    </div>
                    <span className="text-white text-sm font-medium">{user?.username}</span>
                    <span className="text-gray-500 text-xs">▾</span>
                  </button>

                  {/* Dropdown menu - appears on hover */}
                  <div className="absolute right-0 top-full mt-2 w-48 bg-gray-900 border border-gray-700 rounded-xl shadow-xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all">
                    <div className="p-1">
                      <Link
                        to="/profile"
                        className="block px-4 py-2.5 text-sm text-gray-300 hover:text-white hover:bg-gray-800 rounded-lg transition-colors"
                      >
                        👤 My Profile
                      </Link>
                      <Link
                        to="/my-cards"
                        className="block px-4 py-2.5 text-sm text-gray-300 hover:text-white hover:bg-gray-800 rounded-lg transition-colors"
                      >
                        🎴 My Cards
                      </Link>
                      <Link
                        to="/my-bids"
                        className="block px-4 py-2.5 text-sm text-gray-300 hover:text-white hover:bg-gray-800 rounded-lg transition-colors"
                      >
                        💰 My Bids
                      </Link>
                      <div className="h-px bg-gray-800 my-1" />
                      <button
                        onClick={handleLogout}
                        className="w-full text-left px-4 py-2.5 text-sm text-red-400 hover:text-red-300 hover:bg-gray-800 rounded-lg transition-colors"
                      >
                        🚪 Sign Out
                      </button>
                    </div>
                  </div>
                </div>
              </>
            ) : (
              <>
                {/* Not logged in */}
                <Link
                  to="/login"
                  className="text-gray-400 hover:text-white text-sm font-medium transition-colors"
                >
                  Sign In
                </Link>
                <Link
                  to="/signup"
                  className="bg-violet-600 hover:bg-violet-500 text-white px-4 py-2 rounded-xl text-sm font-bold transition-all hover:scale-105"
                >
                  Get Started
                </Link>
              </>
            )}
          </div>

          {/* ── MOBILE MENU BUTTON ── */}
          <button
            onClick={() => setMobileOpen(!mobileOpen)}
            className="md:hidden text-gray-400 hover:text-white transition-colors"
          >
            {/* Hamburger / X icon */}
            {mobileOpen ? '✕' : '☰'}
          </button>
        </div>

        {/* ── MOBILE MENU ── */}
        {/* Only shown on mobile when mobileOpen is true */}
        {mobileOpen && (
          <div className="md:hidden border-t border-gray-800 py-4 space-y-2">
            {[
              { to: '/', label: '🏠 Home' },
              { to: '/cards', label: '🎴 Browse Cards' },
              { to: '/streams', label: '📡 Live Streams' },
            ].map((link) => (
              <Link
                key={link.to}
                to={link.to}
                onClick={() => setMobileOpen(false)}
                className="block px-4 py-3 text-gray-300 hover:text-white hover:bg-gray-800 rounded-xl transition-colors"
              >
                {link.label}
              </Link>
            ))}

            <div className="h-px bg-gray-800 my-2" />

            {isAuthenticated ? (
              <>
                <Link
                  to="/cards/new"
                  onClick={() => setMobileOpen(false)}
                  className="block px-4 py-3 text-gray-300 hover:text-white hover:bg-gray-800 rounded-xl transition-colors"
                >
                  + List a Card
                </Link>
                <Link
                  to="/profile"
                  onClick={() => setMobileOpen(false)}
                  className="block px-4 py-3 text-gray-300 hover:text-white hover:bg-gray-800 rounded-xl transition-colors"
                >
                  👤 {user?.username}
                </Link>
                <button
                  onClick={handleLogout}
                  className="w-full text-left px-4 py-3 text-red-400 hover:bg-gray-800 rounded-xl transition-colors"
                >
                  🚪 Sign Out
                </button>
              </>
            ) : (
              <>
                <Link
                  to="/login"
                  onClick={() => setMobileOpen(false)}
                  className="block px-4 py-3 text-gray-300 hover:text-white hover:bg-gray-800 rounded-xl transition-colors"
                >
                  Sign In
                </Link>
                <Link
                  to="/signup"
                  onClick={() => setMobileOpen(false)}
                  className="block bg-violet-600 text-white px-4 py-3 rounded-xl font-bold text-center transition-all"
                >
                  Get Started Free
                </Link>
              </>
            )}
          </div>
        )}
      </div>
    </nav>
  );
}

export default Navbar;
