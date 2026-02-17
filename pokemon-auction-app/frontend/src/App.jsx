import React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';

// ── PAGE IMPORTS ──────────────────────────────────────────────
// Each import brings in a page component from its file.
// The string path after "from" is the relative file location.

import Navbar from './components/common/Navbar';
import HomePage from './pages/HomePage';
import LoginPage from './pages/LoginPage';
import SignupPage from './pages/SignupPage';
import ProfilePage from './pages/ProfilePage';
import LivestreamPage from './pages/LivestreamPage';
import CardDetailPage from './pages/CardDetailPage';
import ListCardPage from './pages/ListCardPage'; // ← NEW

// ============================================================
// APP.JSX - The Root Component
// ============================================================
// This is the entry point of your frontend app.
// It wraps everything in:
//
// 1. AuthProvider - Makes user login state available everywhere
// 2. BrowserRouter - Enables URL-based navigation
// 3. Routes - Defines which component shows at which URL
//
// HOW ROUTING WORKS:
// When user goes to /login → LoginPage component renders
// When user goes to /cards/new → ListCardPage component renders
// The Navbar is OUTSIDE Routes so it shows on EVERY page
// ============================================================

function App() {
  return (
    // AuthProvider wraps everything so any component can access
    // the logged-in user, login(), logout() functions
    <AuthProvider>

      {/* BrowserRouter enables React Router navigation */}
      <BrowserRouter>

        {/* Outer div takes full screen height, dark background */}
        <div className="min-h-screen bg-gray-950 flex flex-col">

          {/* Navbar is outside Routes = shows on every page */}
          <Navbar />

          {/* Main content area - flex: 1 makes it fill remaining height */}
          <main className="flex-1">
            <Routes>
              {/* Each Route maps a URL path to a component */}
              {/* path="/" = homepage, exact match */}
              <Route path="/" element={<HomePage />} />

              {/* Auth routes */}
              <Route path="/login" element={<LoginPage />} />
              <Route path="/signup" element={<SignupPage />} />
              <Route path="/profile" element={<ProfilePage />} />

              {/* Card routes */}
              {/* /cards/new MUST come before /cards/:id */}
              {/* Otherwise React Router might think "new" is an ID */}
              <Route path="/cards/new" element={<ListCardPage />} />
              <Route path="/card/:cardId" element={<CardDetailPage />} />

              {/* Stream routes */}
              {/* :id means any value - accessible as params.id in component */}
              <Route path="/livestream/:id" element={<LivestreamPage />} />

              {/* 404 - catches any unmatched routes */}
              <Route path="*" element={
                <div className="min-h-screen bg-gray-950 flex items-center justify-center text-center">
                  <div>
                    <div className="text-8xl mb-6">404</div>
                    <h1 className="text-3xl font-bold text-white mb-4">Page not found</h1>
                    <p className="text-gray-500 mb-8">The page you're looking for doesn't exist.</p>
                    <a href="/" className="bg-violet-600 text-white px-6 py-3 rounded-xl font-bold hover:bg-violet-500 transition-all">
                      Go Home
                    </a>
                  </div>
                </div>
              } />
            </Routes>
          </main>

        </div>
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;
