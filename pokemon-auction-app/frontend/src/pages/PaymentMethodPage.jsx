import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { useAuth } from '../context/AuthContext';
import { userService } from '../services/userService';

function PaymentMethodPage() {
  const { user, isAuthenticated, loading: authLoading, updateUser } = useAuth();
  const navigate = useNavigate();
  const [submitting, setSubmitting] = useState(false);

  if (!authLoading && !isAuthenticated) {
    navigate('/login');
    return null;
  }

  const handleAdd = async () => {
    setSubmitting(true);
    try {
      const { user: updated } = await userService.addPaymentMethod();
      updateUser(updated);
      toast.success('Payment method added');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to add payment method');
    } finally {
      setSubmitting(false);
    }
  };

  const hasPayment = !!user?.has_payment_method;

  return (
    <div className="min-h-screen bg-[#0f1419] text-white px-6 py-10">
      <div className="max-w-xl mx-auto">
        <button
          onClick={() => navigate(-1)}
          className="text-gray-400 hover:text-white text-sm mb-6"
        >
          ← Back
        </button>

        <h1 className="text-3xl font-black mb-2">Payment Method</h1>
        <p className="text-gray-400 mb-6">
          A payment method is required to place bids and buy now. This is a stub — real Stripe
          integration is coming soon.
        </p>

        <div className="bg-[#1a1f2e] border border-gray-800 rounded-2xl p-6 mb-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">Current status</p>
              <p className={`text-lg font-bold ${hasPayment ? 'text-green-400' : 'text-gray-400'}`}>
                {hasPayment ? 'On file' : 'None'}
              </p>
            </div>
            {hasPayment && (
              <span className="bg-green-600/20 text-green-400 text-xs font-bold px-3 py-1 rounded-full">
                ACTIVE
              </span>
            )}
          </div>
        </div>

        <button
          onClick={handleAdd}
          disabled={submitting || hasPayment}
          className="w-full bg-violet-600 hover:bg-violet-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold py-3 rounded-xl transition-colors"
        >
          {hasPayment
            ? 'Payment method already on file'
            : submitting
              ? 'Adding…'
              : 'Add Payment Method (stub)'}
        </button>

        <div className="mt-6 bg-amber-600/10 border border-amber-600/30 rounded-xl p-4">
          <p className="text-amber-300 text-sm">
            <span className="font-bold">Heads up:</span> this button just flips a flag in the database.
            When Stripe is wired up, this page will collect a card and create a SetupIntent.
          </p>
        </div>
      </div>
    </div>
  );
}

export default PaymentMethodPage;
