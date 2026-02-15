import React from 'react';
import { useAuth } from '../context/AuthContext';
import { Navigate } from 'react-router-dom';

function ProfilePage() {
  const { user, isAuthenticated, logout } = useAuth();

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return (
    <div className="profile-page">
      <div className="profile-container card">
        <h1>Profile</h1>
        
        <div className="profile-info">
          <div className="info-row">
            <strong>Username:</strong>
            <span>{user?.username}</span>
          </div>
          <div className="info-row">
            <strong>Email:</strong>
            <span>{user?.email}</span>
          </div>
          <div className="info-row">
            <strong>Member since:</strong>
            <span>{new Date(user?.createdAt).toLocaleDateString()}</span>
          </div>
        </div>

        <button onClick={logout} className="btn btn-secondary">
          Logout
        </button>
      </div>

      <div className="profile-sections">
        <section className="card">
          <h2>My Listings</h2>
          <p>Your card listings will appear here</p>
        </section>

        <section className="card">
          <h2>My Bids</h2>
          <p>Your bid history will appear here</p>
        </section>

        <section className="card">
          <h2>Won Auctions</h2>
          <p>Auctions you've won will appear here</p>
        </section>
      </div>
    </div>
  );
}

export default ProfilePage;
