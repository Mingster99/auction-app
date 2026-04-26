import React, { useEffect, useRef } from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import toast from 'react-hot-toast';
import { useAuth } from '../../context/AuthContext';

export default function RequireAdmin() {
  const { user, loading } = useAuth();
  const toastedRef = useRef(false);

  const denied = !loading && user && !user.is_admin;

  useEffect(() => {
    if (denied && !toastedRef.current) {
      toastedRef.current = true;
      toast.error('Admin access required');
    }
  }, [denied]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0f1419] flex items-center justify-center">
        <p className="text-gray-400">Loading…</p>
      </div>
    );
  }

  if (!user) return <Navigate to="/login" replace />;
  if (denied) return <Navigate to="/" replace />;

  return <Outlet />;
}
