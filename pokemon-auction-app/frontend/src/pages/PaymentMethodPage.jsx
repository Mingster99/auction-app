import React, { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { loadAirwallex, createElement } from 'airwallex-payment-elements';
import { useAuth } from '../context/AuthContext';
import { userService } from '../services/userService';

function PaymentMethodPage() {
  const { user, isAuthenticated, loading: authLoading, updateUser } = useAuth();
  const navigate = useNavigate();
  const [step, setStep] = useState('idle'); // idle | loading | card | done | error
  const [isSaving, setIsSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const cardElementRef = useRef(null);
  const sessionRef = useRef(null); // { card, clientSecret, customerId }

  if (!authLoading && !isAuthenticated) {
    navigate('/login');
    return null;
  }

  const hasPayment = !!user?.has_payment_method;

  const handleSetup = async () => {
    setStep('loading');
    setErrorMsg('');
    try {
      const { clientSecret, customerId } = await userService.initPaymentMethod();

      await loadAirwallex({
        env: process.env.REACT_APP_AIRWALLEX_ENV || 'demo',
        origin: window.location.origin,
      });

      const card = createElement('card', {
        mode: 'recurring',
        client_secret: clientSecret,
        customer_id: customerId,
        currency: 'SGD',
        recurringOptions: {
          next_triggered_by: 'merchant',
          merchant_trigger_reason: 'scheduled',
        },
        style: { base: { color: '#fff', '::placeholder': { color: '#6b7280' } } },
      });

      card.on('ready',   (e) => console.log('[card event] ready', e));
      card.on('success', (e) => console.log('[card event] success', e));
      card.on('error',   (e) => console.log('[card event] error', e));

      sessionRef.current = { card, clientSecret, customerId };
      console.log('[Setup] customerId:', customerId);
      console.log('[Setup] clientSecret length:', clientSecret?.length, 'prefix:', clientSecret?.slice(0, 30));
      setStep('card');

      setTimeout(() => {
        if (cardElementRef.current) card.mount(cardElementRef.current);
      }, 50);
    } catch (err) {
      setErrorMsg(err.response?.data?.message || err.message || 'Failed to initialize payment');
      setStep('error');
    }
  };

  const handleSave = async () => {
    // NOTE: do NOT call setStep here — changing step unmounts the card form which destroys the iframe
    // and the createPaymentConsent promise will never resolve.
    setIsSaving(true);
    setErrorMsg('');
    try {
      const { card, clientSecret, customerId } = sessionRef.current;

      console.log('[Save] clientSecret length:', clientSecret?.length);
      console.log('[Save] clientSecret prefix:', clientSecret?.slice(0, 30));
      console.log('[Save] customerId:', customerId);
      console.log('[Save] card element type:', card?.elementType);
      console.log('[Save] card.paymentConsent before:', JSON.stringify(card.paymentConsent));
      console.log('[Save] card iframe in DOM:', document.contains(card.iframe));
      console.log('[Save] card iframe src:', card.iframe?.src);
      console.log('[Save] card iframe size:', card.iframe?.offsetWidth, 'x', card.iframe?.offsetHeight);

      const msgLog = (e) => {
        if (e.origin?.includes('airwallex')) {
          console.log('[iframe→parent msg]', e.origin, typeof e.data, e.data);
        }
      };
      window.addEventListener('message', msgLog);

      window.addEventListener('onSuccess', (e) => console.log('[window onSuccess]', e.detail));
      window.addEventListener('onError',   (e) => console.log('[window onError]',   e.detail));

      console.log('[Save] calling card.createPaymentConsent(...)');
      const promise = card.createPaymentConsent({
        client_secret: clientSecret,
        customer_id: customerId,
        currency: 'SGD',
        next_triggered_by: 'merchant',
        merchant_trigger_reason: 'scheduled',
      });
      console.log('[Save] got a promise back:', promise instanceof Promise);

      setTimeout(() => console.log('[Save] paymentConsent @500ms:', JSON.stringify(card.paymentConsent)), 500);
      setTimeout(() => console.log('[Save] paymentConsent @3s:',   JSON.stringify(card.paymentConsent)), 3000);
      setTimeout(() => console.log('[Save] confirmIntent @3s:',    JSON.stringify(card.confirmIntent)),   3000);

      const result = await promise;
      console.log('[Save] resolved with:', JSON.stringify(result));
      window.removeEventListener('message', msgLog);

      if (result?.error) throw new Error(result.error.message || 'Card confirmation failed');

      const consentId = result?.payment_consent_id;
      console.log('[Save] consentId from result:', consentId);
      if (!consentId) throw new Error('No consent ID returned from Airwallex — full result: ' + JSON.stringify(result));

      const { user: updated } = await userService.confirmPaymentMethod(consentId);
      updateUser(updated);
      setIsSaving(false);
      setStep('done');
      toast.success('Card saved successfully');
    } catch (err) {
      console.error('[Save] error:', err);
      setIsSaving(false);
      setErrorMsg(err.message || 'Card confirmation failed');
      setStep('error');
    }
  };

  return (
    <div className="min-h-screen bg-[#0f1419] text-white px-6 py-10">
      <div className="max-w-xl mx-auto">
        <button onClick={() => navigate(-1)} className="text-gray-400 hover:text-white text-sm mb-6">
          ← Back
        </button>

        <h1 className="text-3xl font-black mb-2">Payment Method</h1>
        <p className="text-gray-400 mb-6">
          A card on file is required to place bids and buy now. Your card is charged the moment you win.
        </p>

        {/* Current status */}
        <div className="bg-[#1a1f2e] border border-gray-800 rounded-2xl p-6 mb-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">Current status</p>
              <p className={`text-lg font-bold ${hasPayment ? 'text-green-400' : 'text-gray-400'}`}>
                {hasPayment ? 'Card on file' : 'No card saved'}
              </p>
            </div>
            {hasPayment && (
              <span className="bg-green-600/20 text-green-400 text-xs font-bold px-3 py-1 rounded-full">
                ACTIVE
              </span>
            )}
          </div>
        </div>

        {errorMsg && (
          <div className="bg-red-500/10 border border-red-500/30 text-red-300 rounded-xl px-4 py-3 mb-4 text-sm">
            {errorMsg}
          </div>
        )}

        {(step === 'idle' || step === 'error') && !hasPayment && (
          <button
            onClick={handleSetup}
            className="w-full bg-violet-600 hover:bg-violet-700 text-white font-bold py-3 rounded-xl transition-colors"
          >
            Add Card
          </button>
        )}

        {step === 'loading' && (
          <div className="bg-[#1a1f2e] border border-gray-800 rounded-2xl p-6 text-center text-gray-400">
            Loading card form…
          </div>
        )}

        {step === 'card' && (
          <div className="bg-[#1a1f2e] border border-gray-800 rounded-2xl p-6 space-y-4">
            <p className="text-sm text-gray-400">
              {isSaving ? 'Saving card…' : 'Enter your card details'}
            </p>
            {/* iframe must stay mounted during save — do not conditionally remove this div */}
            <div
              ref={cardElementRef}
              className="min-h-[50px] bg-gray-900 border border-gray-700 rounded-xl px-4 py-3"
            />
            <div className="flex gap-3">
              <button
                onClick={handleSave}
                disabled={isSaving}
                className="flex-1 bg-violet-600 hover:bg-violet-700 disabled:opacity-50 text-white font-bold py-3 rounded-xl transition-colors"
              >
                {isSaving ? 'Saving…' : 'Save Card'}
              </button>
              <button
                onClick={() => setStep('idle')}
                disabled={isSaving}
                className="flex-1 bg-gray-800 hover:bg-gray-700 disabled:opacity-50 text-white py-3 rounded-xl transition-colors"
              >
                Cancel
              </button>
            </div>
            <p className="text-xs text-gray-600 text-center">
              Test card: 4035 5010 0000 0008 · any future expiry · any CVC
            </p>
          </div>
        )}

        {(step === 'done' || hasPayment) && (
          <div className="bg-green-600/10 border border-green-600/30 rounded-xl p-4">
            <p className="text-green-400 text-sm font-medium">
              Your card is saved. You can now bid and buy now in live auctions — you'll be charged automatically when you win.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

export default PaymentMethodPage;
