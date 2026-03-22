import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';

// ============================================================
// PSA IMPORT PAGE
// ============================================================
// Allows sellers to:
// 1. Scan a PSA slab QR code OR enter cert number manually
// 2. Preview the pulled card data
// 3. Confirm and add to their inventory
// 4. Upload images if PSA didn't provide them
// ============================================================

function PSAImportPage() {
  const { user } = useAuth();
  const navigate = useNavigate();

  // Flow state: 'input' → 'preview' → 'done'
  const [step, setStep] = useState('input');
  const [scannerActive, setScannerActive] = useState(false);
  const [certNumber, setCertNumber] = useState('');
  const [psaData, setPsaData] = useState(null);
  const [importedCard, setImportedCard] = useState(null);
  const [startingBid, setStartingBid] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Image upload refs
  const frontInputRef = useRef(null);
  const backInputRef = useRef(null);
  const [frontPreview, setFrontPreview] = useState(null);
  const [backPreview, setBackPreview] = useState(null);
  const [frontFile, setFrontFile] = useState(null);
  const [backFile, setBackFile] = useState(null);

  // QR Scanner ref
  const scannerRef = useRef(null);
  const scannerContainerId = 'psa-qr-scanner';

  // ── QR SCANNER ──────────────────────────────────────────
  const startScanner = async () => {
    setScannerActive(true);
    setError('');

    // Dynamically import html5-qrcode (avoids SSR issues)
    try {
      const { Html5QrcodeScanner } = await import('html5-qrcode');

      // Small delay to let the container mount
      setTimeout(() => {
        const scanner = new Html5QrcodeScanner(
          scannerContainerId,
          {
            fps: 10,
            qrbox: { width: 250, height: 250 },
            aspectRatio: 1,
            rememberLastUsedCamera: true,
          },
          false // verbose
        );

        scanner.render(
          (decodedText) => {
            console.log('📱 QR scanned:', decodedText);
            // PSA QR codes contain the cert URL or cert number
            const extracted = extractCertNumber(decodedText);
            if (extracted) {
              setCertNumber(extracted);
              stopScanner();
              handleLookup(extracted);
            } else {
              setError('Could not extract cert number from QR code. Try entering it manually.');
            }
          },
          (errorMessage) => {
            // Scan errors are normal (camera noise), don't show to user
          }
        );

        scannerRef.current = scanner;
      }, 100);
    } catch (err) {
      setError('Camera not available. Please enter the cert number manually.');
      setScannerActive(false);
    }
  };

  const stopScanner = () => {
    if (scannerRef.current) {
      scannerRef.current.clear().catch(() => {});
      scannerRef.current = null;
    }
    setScannerActive(false);
  };

  // Extract cert number from QR text
  // PSA QR codes can contain:
  //   - Just the cert number: "12345678"
  //   - A URL: "https://www.psacard.com/cert/12345678"
  const extractCertNumber = (text) => {
    if (!text) return null;

    // If it's a URL, grab the number from the path
    const urlMatch = text.match(/cert\/(\d+)/i);
    if (urlMatch) return urlMatch[1];

    // If it's just digits
    const digitMatch = text.match(/(\d{5,})/);
    if (digitMatch) return digitMatch[1];

    return null;
  };

  // Cleanup scanner on unmount
  useEffect(() => {
    return () => stopScanner();
  }, []);

  // ── LOOKUP ──────────────────────────────────────────────
  const handleLookup = async (certNum) => {
    const cert = certNum || certNumber;
    if (!cert.trim()) {
      setError('Please enter a cert number');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const response = await api.post('/cards/psa-lookup', {
        certNumber: cert.trim(),
      });

      const data = response.data;

      if (data.alreadyImported) {
        setError(`This card is already in your inventory (${data.card.name})`);
        setLoading(false);
        return;
      }

      setPsaData(data.psaData);
      setStep('preview');
    } catch (err) {
      const msg = err.response?.data?.message || 'Failed to look up cert number';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  // ── IMPORT ──────────────────────────────────────────────
  const handleImport = async () => {
    if (!psaData) return;
    setLoading(true);
    setError('');

    try {
      const response = await api.post('/cards/psa-import', {
        certNumber: psaData.certNumber,
        startingBid: parseFloat(startingBid) || 0,
      });

      const data = response.data;
      setImportedCard(data.card);

      // If images need uploading, stay on preview with upload UI
      if (data.needsImageUpload) {
        setStep('upload');
      } else {
        setStep('done');
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to import card');
    } finally {
      setLoading(false);
    }
  };

  // ── IMAGE UPLOAD ────────────────────────────────────────
  const handleFileSelect = (file, side) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      if (side === 'front') {
        setFrontPreview(e.target.result);
        setFrontFile(file);
      } else {
        setBackPreview(e.target.result);
        setBackFile(file);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleUploadImages = async () => {
    if (!importedCard || (!frontFile && !backFile)) {
      setError('Please select at least one image');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const formData = new FormData();
      if (frontFile) formData.append('front', frontFile);
      if (backFile) formData.append('back', backFile);

      await api.post(`/cards/${importedCard.id}/upload-images`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      setStep('done');
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to upload images');
    } finally {
      setLoading(false);
    }
  };

  // ── RENDER ──────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-[#0f1419] text-white">
      <div className="max-w-2xl mx-auto p-6">

        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-black mb-2">
            {step === 'input' && '🔍 Import PSA Card'}
            {step === 'preview' && '✅ Confirm Card Details'}
            {step === 'upload' && '📸 Upload Slab Photos'}
            {step === 'done' && '🎉 Card Added!'}
          </h1>
          <p className="text-gray-400">
            {step === 'input' && 'Scan the QR code on your PSA slab or enter the cert number manually.'}
            {step === 'preview' && 'Review the card details pulled from PSA before adding to your inventory.'}
            {step === 'upload' && 'PSA didn\'t have images for this card. Upload your own slab photos.'}
            {step === 'done' && 'Your card has been added to your inventory.'}
          </p>
        </div>

        {/* Error */}
        {error && (
          <div className="bg-red-500/20 border border-red-500/50 text-red-300 p-4 rounded-xl mb-6">
            {error}
          </div>
        )}

        {/* ─── STEP 1: INPUT ──────────────────────────── */}
        {step === 'input' && (
          <div className="space-y-6">

            {/* QR Scanner */}
            {scannerActive ? (
              <div className="space-y-3">
                <div
                  id={scannerContainerId}
                  className="rounded-xl overflow-hidden bg-black"
                />
                <button
                  onClick={stopScanner}
                  className="text-sm text-gray-400 hover:text-white transition-colors"
                >
                  Cancel scanning
                </button>
              </div>
            ) : (
              <button
                onClick={startScanner}
                className="w-full bg-[#1a1f2e] border-2 border-dashed border-gray-700 hover:border-violet-500/50 rounded-2xl p-8 transition-colors group"
              >
                <div className="text-center">
                  <span className="text-4xl block mb-3">📱</span>
                  <span className="text-lg font-bold group-hover:text-violet-300 transition-colors">
                    Scan PSA QR Code
                  </span>
                  <span className="block text-sm text-gray-500 mt-1">
                    Use your camera to scan the QR code on the PSA slab
                  </span>
                </div>
              </button>
            )}

            {/* Divider */}
            <div className="flex items-center gap-4">
              <div className="flex-1 h-px bg-gray-800" />
              <span className="text-gray-600 text-sm font-medium">OR</span>
              <div className="flex-1 h-px bg-gray-800" />
            </div>

            {/* Manual Input */}
            <div>
              <label className="block text-sm text-gray-400 mb-2">
                Enter PSA Cert Number
              </label>
              <div className="flex gap-3">
                <input
                  type="text"
                  value={certNumber}
                  onChange={(e) => {
                    setCertNumber(e.target.value.replace(/\D/g, ''));
                    setError('');
                  }}
                  placeholder="e.g. 79721014"
                  className="flex-1 bg-gray-900 border border-gray-700 rounded-xl px-4 py-3 text-white text-lg tracking-wider focus:border-violet-500 focus:ring-2 focus:ring-violet-500/20 outline-none"
                  maxLength={12}
                />
                <button
                  onClick={() => handleLookup()}
                  disabled={loading || !certNumber.trim()}
                  className="bg-violet-600 hover:bg-violet-700 disabled:opacity-50 text-white font-bold px-6 py-3 rounded-xl transition-colors"
                >
                  {loading ? (
                    <span className="inline-block w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : (
                    'Look Up'
                  )}
                </button>
              </div>
              <p className="text-xs text-gray-600 mt-2">
                The cert number is printed on the PSA label inside the slab (8-10 digits)
              </p>
            </div>
          </div>
        )}

        {/* ─── STEP 2: PREVIEW ────────────────────────── */}
        {step === 'preview' && psaData && (
          <div className="space-y-6">

            {/* Card Preview */}
            <div className="bg-[#1a1f2e] rounded-2xl border border-gray-800 overflow-hidden">
              {/* Images */}
              {psaData.hasImages && (
                <div className="flex gap-2 p-4 bg-gray-900/50">
                  {psaData.frontImage && (
                    <img
                      src={psaData.frontImage}
                      alt="Front"
                      className="w-1/2 rounded-lg object-contain max-h-80"
                    />
                  )}
                  {psaData.backImage && (
                    <img
                      src={psaData.backImage}
                      alt="Back"
                      className="w-1/2 rounded-lg object-contain max-h-80"
                    />
                  )}
                </div>
              )}

              {!psaData.hasImages && (
                <div className="p-8 bg-gray-900/50 text-center">
                  <span className="text-3xl block mb-2">📷</span>
                  <p className="text-gray-500 text-sm">
                    No images available from PSA — you can upload your own after import
                  </p>
                </div>
              )}

              {/* Details */}
              <div className="p-5 space-y-3">
                <div className="flex items-start justify-between">
                  <div>
                    <h2 className="text-xl font-bold">
                      {psaData.subject || 'Unknown Card'}
                      {psaData.cardNumber && ` #${psaData.cardNumber}`}
                    </h2>
                    <p className="text-gray-400 text-sm">{psaData.description}</p>
                  </div>
                  <div className="bg-violet-600 text-white font-black text-lg px-3 py-1 rounded-lg shrink-0">
                    PSA {psaData.grade}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3 pt-3 border-t border-gray-800">
                  <Detail label="Cert #" value={psaData.certNumber} />
                  <Detail label="Year" value={psaData.year} />
                  <Detail label="Brand" value={psaData.brand} />
                  <Detail label="Category" value={psaData.category} />
                  {psaData.variety && <Detail label="Variety" value={psaData.variety} />}
                  {psaData.labelType && <Detail label="Label" value={psaData.labelType} />}
                </div>

                {/* PSA verified badge */}
                <div className="flex items-center gap-2 pt-3 border-t border-gray-800">
                  <span className="w-5 h-5 bg-green-500 rounded-full flex items-center justify-center text-xs">✓</span>
                  <span className="text-green-400 text-sm font-medium">PSA Verified</span>
                </div>
              </div>
            </div>

            {/* Starting Bid (optional) */}
            <div>
              <label className="block text-sm text-gray-400 mb-2">
                Starting Bid (optional — set later if you prefer)
              </label>
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500">$</span>
                <input
                  type="number"
                  value={startingBid}
                  onChange={(e) => setStartingBid(e.target.value)}
                  placeholder="0.00"
                  className="w-full bg-gray-900 border border-gray-700 rounded-xl pl-8 pr-4 py-3 text-white focus:border-violet-500 focus:ring-2 focus:ring-violet-500/20 outline-none"
                  min="0"
                  step="0.01"
                />
              </div>
            </div>

            {/* Actions */}
            <div className="flex gap-3">
              <button
                onClick={() => {
                  setStep('input');
                  setPsaData(null);
                  setError('');
                }}
                className="bg-gray-800 hover:bg-gray-700 text-white px-6 py-3 rounded-xl transition-colors"
              >
                Back
              </button>
              <button
                onClick={handleImport}
                disabled={loading}
                className="flex-1 bg-violet-600 hover:bg-violet-700 disabled:opacity-50 text-white font-bold px-6 py-3 rounded-xl transition-colors"
              >
                {loading ? 'Importing...' : '✅ Add to My Cards'}
              </button>
            </div>
          </div>
        )}

        {/* ─── STEP 3: UPLOAD IMAGES ──────────────────── */}
        {step === 'upload' && (
          <div className="space-y-6">
            <div className="grid grid-cols-2 gap-4">
              {/* Front image */}
              <div>
                <label className="block text-sm text-gray-400 mb-2">Front of Slab</label>
                <div
                  onClick={() => frontInputRef.current?.click()}
                  className="bg-gray-900 border-2 border-dashed border-gray-700 hover:border-violet-500/50 rounded-xl aspect-[3/4] flex items-center justify-center cursor-pointer transition-colors overflow-hidden"
                >
                  {frontPreview ? (
                    <img src={frontPreview} alt="Front" className="w-full h-full object-cover" />
                  ) : (
                    <div className="text-center p-4">
                      <span className="text-2xl block mb-1">📷</span>
                      <span className="text-xs text-gray-500">Tap to upload front</span>
                    </div>
                  )}
                </div>
                <input
                  ref={frontInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  className="hidden"
                  onChange={(e) => handleFileSelect(e.target.files[0], 'front')}
                />
              </div>

              {/* Back image */}
              <div>
                <label className="block text-sm text-gray-400 mb-2">Back of Slab</label>
                <div
                  onClick={() => backInputRef.current?.click()}
                  className="bg-gray-900 border-2 border-dashed border-gray-700 hover:border-violet-500/50 rounded-xl aspect-[3/4] flex items-center justify-center cursor-pointer transition-colors overflow-hidden"
                >
                  {backPreview ? (
                    <img src={backPreview} alt="Back" className="w-full h-full object-cover" />
                  ) : (
                    <div className="text-center p-4">
                      <span className="text-2xl block mb-1">📷</span>
                      <span className="text-xs text-gray-500">Tap to upload back</span>
                    </div>
                  )}
                </div>
                <input
                  ref={backInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  className="hidden"
                  onChange={(e) => handleFileSelect(e.target.files[0], 'back')}
                />
              </div>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setStep('done')}
                className="bg-gray-800 hover:bg-gray-700 text-white px-6 py-3 rounded-xl transition-colors"
              >
                Skip for Now
              </button>
              <button
                onClick={handleUploadImages}
                disabled={loading || (!frontFile && !backFile)}
                className="flex-1 bg-violet-600 hover:bg-violet-700 disabled:opacity-50 text-white font-bold px-6 py-3 rounded-xl transition-colors"
              >
                {loading ? 'Uploading...' : '📸 Upload Photos'}
              </button>
            </div>
          </div>
        )}

        {/* ─── STEP 4: DONE ───────────────────────────── */}
        {step === 'done' && (
          <div className="text-center space-y-6">
            <div className="bg-[#1a1f2e] rounded-2xl border border-gray-800 p-8">
              <span className="text-5xl block mb-4">🎉</span>
              <h2 className="text-xl font-bold mb-2">Card Added to Inventory!</h2>
              <p className="text-gray-400">
                {importedCard?.name} — PSA {importedCard?.psa_grade}
              </p>
            </div>

            <div className="flex gap-3 justify-center">
              <button
                onClick={() => {
                  setStep('input');
                  setCertNumber('');
                  setPsaData(null);
                  setImportedCard(null);
                  setStartingBid('');
                  setFrontPreview(null);
                  setBackPreview(null);
                  setFrontFile(null);
                  setBackFile(null);
                  setError('');
                }}
                className="bg-gray-800 hover:bg-gray-700 text-white px-6 py-3 rounded-xl transition-colors"
              >
                Import Another
              </button>
              <button
                onClick={() => navigate('/my-cards')}
                className="bg-violet-600 hover:bg-violet-700 text-white font-bold px-6 py-3 rounded-xl transition-colors"
              >
                View Inventory
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// Helper component for detail rows
function Detail({ label, value }) {
  if (!value) return null;
  return (
    <div>
      <span className="text-xs text-gray-500 block">{label}</span>
      <span className="text-sm text-white">{value}</span>
    </div>
  );
}

export default PSAImportPage;
