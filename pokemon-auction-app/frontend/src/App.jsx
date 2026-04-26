import React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { AuthProvider } from './context/AuthContext';
import { NotificationProvider } from './context/NotificationContext';

import Navbar from './components/common/Navbar';
import HomePage from './pages/HomePage';
import LoginPage from './pages/LoginPage';
import SignupPage from './pages/SignupPage';
import ProfilePage from './pages/ProfilePage';
import LivestreamPage from './pages/LivestreamPage';
import CardDetailPage from './pages/CardDetailPage';
import ListCardPage from './pages/ListCardPage';
import StreamHostPage from './pages/StreamHostPage';
import PSAImportPage from './pages/PSAImportPage';
import MyCardsPage from './pages/MyCardsPage';
import BrowseCardsPage from './pages/BrowseCardsPage';
import SellerProfilePage from './pages/SellerProfilePage';
import UpcomingStreamsPage from './pages/UpcomingStreamsPage';
import PaymentMethodPage from './pages/PaymentMethodPage';
import DashboardPage from './pages/DashboardPage';
import RequireVerifiedSeller from './components/common/RequireVerifiedSeller';
import MyInvoicesPage from './pages/MyInvoicesPage';
import AdminReviewPage from './pages/AdminReviewPage';
import RequireAdmin from './components/common/RequireAdmin';

function App() {
  return (
    <AuthProvider>
      <NotificationProvider>
        <BrowserRouter>
          <div className="min-h-screen bg-gray-950 flex flex-col">
            <Navbar />

            <main className="flex-1">
              <Routes>
                <Route path="/" element={<HomePage />} />

                <Route path="/login" element={<LoginPage />} />
                <Route path="/signup" element={<SignupPage />} />
                <Route path="/profile" element={<ProfilePage />} />

                <Route path="/cards/new" element={<ListCardPage />} />
                <Route path="/psa-import" element={<PSAImportPage />} />
                <Route path="/card/:cardId" element={<CardDetailPage />} />

                <Route path="/seller/:username" element={<SellerProfilePage />} />

                <Route path="/livestream/:id" element={<LivestreamPage />} />
                <Route path="/stream/host" element={<StreamHostPage />} />

                <Route path="/my-cards" element={<MyCardsPage />} />

                <Route path="/cards" element={<BrowseCardsPage />} />
                <Route path="/upcoming-streams" element={<UpcomingStreamsPage />} />

                <Route path="/settings/payment" element={<PaymentMethodPage />} />

                <Route element={<RequireVerifiedSeller />}>
                  <Route path="/dashboard" element={<DashboardPage />} />
                </Route>

                <Route path="/my-invoices" element={<MyInvoicesPage />} />

                <Route element={<RequireAdmin />}>
                  <Route path="/admin" element={<AdminReviewPage />} />
                </Route>

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

          <Toaster
            position="top-right"
            toastOptions={{
              duration: 3500,
              style: {
                background: '#1a1f2e',
                color: '#fff',
                border: '1px solid #374151',
                borderRadius: '12px',
                fontSize: '14px',
              },
              success: {
                iconTheme: { primary: '#10b981', secondary: '#fff' },
              },
              error: {
                iconTheme: { primary: '#ef4444', secondary: '#fff' },
              },
            }}
          />
        </BrowserRouter>
      </NotificationProvider>
    </AuthProvider>
  );
}

export default App;
