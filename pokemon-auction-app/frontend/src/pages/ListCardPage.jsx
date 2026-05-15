import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { cardService } from '../services/cardService';
import api from '../services/api';

// ============================================================
// HOW THIS FILE WORKS (React Explanation for Beginners)
// ============================================================
//
// This page lets sellers create a new card listing.
//
// KEY CONCEPTS USED HERE:
//
// 1. CONTROLLED FORM: All form inputs are "controlled" by React.
//    This means React state holds the value of every input.
//    When user types, onChange updates the state.
//    React then re-renders the input with the new value.
//    This gives us full control over the form data.
//
// 2. FORM OBJECT PATTERN: Instead of separate state for each
//    field, we use one object called "formData" with all fields.
//    This is cleaner when you have many form fields.
//
//    const [formData, setFormData] = useState({
//      name: '',
//      price: '',
//      ...
//    });
//
//    To update one field: spread the old object, override one key:
//    setFormData({ ...formData, name: 'Charizard' });
//    The ... (spread) copies all existing values first.
//
// 3. IMAGE PREVIEW: When user picks an image file, we use
//    FileReader to convert it to a URL so we can preview it
//    before uploading to the server.
//
// 4. STEP FORM: We split the form into steps (Step 1, Step 2)
//    to avoid overwhelming the user with all fields at once.
// ============================================================

const TCG_GAMES = [
  { value: 'pokemon',   label: 'Pokémon' },
  { value: 'onepiece',  label: 'One Piece' },
  { value: 'dbs',       label: 'Dragon Ball Super' },
  { value: 'yugioh',    label: 'Yu-Gi-Oh!' },
  { value: 'mtg',       label: 'Magic: The Gathering' },
  { value: 'digimon',   label: 'Digimon' },
  { value: 'cardfight',  label: 'Cardfight!! Vanguard' },
  { value: 'weiss',     label: 'Weiss Schwarz' },
  { value: 'lorcana',   label: 'Disney Lorcana' },
  { value: 'flesh',     label: 'Flesh and Blood' },
  { value: 'union',     label: 'Union Arena' },
  { value: 'other',     label: 'Other TCG' },
];

// Rarity options for the dropdown
const RARITIES = [
  'Common',
  'Uncommon',
  'Rare',
  'Holo Rare',
  'Reverse Holo',
  'Ultra Rare',
  'Secret Rare',
  'Rainbow Rare',
  'Gold',
];

// Condition options
const CONDITIONS = [
  { value: 'Mint', label: 'Mint (M)', desc: 'Perfect condition, never played' },
  { value: 'Near Mint', label: 'Near Mint (NM)', desc: 'Minimal wear, well cared for' },
  { value: 'Lightly Played', label: 'Lightly Played (LP)', desc: 'Minor scratches or wear' },
  { value: 'Moderately Played', label: 'Moderately Played (MP)', desc: 'Visible wear, still playable' },
  { value: 'Heavily Played', label: 'Heavily Played (HP)', desc: 'Heavy wear, functional' },
  { value: 'Damaged', label: 'Damaged (D)', desc: 'Major damage or defects' },
];

function ListCardPage() {

  // ── STATE ──────────────────────────────────────────────────
  const [step, setStep] = useState(1);           // Which step of the form we're on
  const [imagePreview, setImagePreview] = useState(null);
  const [imageUploading, setImageUploading] = useState(false);
  const [backImagePreview, setBackImagePreview] = useState(null);
  const [backImageUploading, setBackImageUploading] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // All form fields in one object
  // This is the data we'll send to the backend
  const [formData, setFormData] = useState({
    name: '',
    tcgGame: '',
    set: '',
    rarity: '',
    condition: '',
    grading: '',
    description: '',
    startingBid: '',
    reservePrice: '',
    buyoutPrice: '',
    auctionDurationSeconds: '60',
    imageUrl: '',
    backImageUrl: '',
  });

  const { isAuthenticated } = useAuth();
  const navigate = useNavigate();

  // ── REDIRECT IF NOT LOGGED IN ──────────────────────────────
  // If user isn't logged in, we shouldn't show this page
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center text-center px-4">
        <div>
          <div className="text-6xl mb-4">🔒</div>
          <h2 className="text-2xl font-bold text-white mb-4">Login Required</h2>
          <p className="text-gray-400 mb-8">You need to be logged in to list a card.</p>
          <Link
            to="/login"
            className="bg-violet-600 hover:bg-violet-500 text-white px-6 py-3 rounded-xl font-bold transition-all"
          >
            Sign In
          </Link>
        </div>
      </div>
    );
  }

  // ── HANDLERS ───────────────────────────────────────────────

  // Called every time user changes any form input
  // [field] = computed property name - uses variable as the key
  const handleChange = (field, value) => {
    setFormData({ ...formData, [field]: value });
    // Example: handleChange('name', 'Charizard')
    // Result: { ...formData, name: 'Charizard' }
    // The ... spreads all existing fields, then overrides 'name'
  };

  // Called when user selects an image file — uploads immediately, stores URL
  const handleImageChange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setError('Please select an image file');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setError('Image must be smaller than 5MB');
      return;
    }

    setError('');

    // Show local preview immediately while uploading
    const reader = new FileReader();
    reader.onload = (event) => setImagePreview(event.target.result);
    reader.readAsDataURL(file);

    setImageUploading(true);
    try {
      const data = new FormData();
      data.append('image', file);
      const response = await api.post('/cards/upload-image', data, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setFormData(prev => ({ ...prev, imageUrl: response.data.url }));
    } catch (err) {
      setError('Image upload failed. Please try again.');
      setImagePreview(null);
    } finally {
      setImageUploading(false);
    }
  };

  const handleBackImageChange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setError('Please select an image file');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setError('Image must be smaller than 5MB');
      return;
    }

    setError('');

    const reader = new FileReader();
    reader.onload = (event) => setBackImagePreview(event.target.result);
    reader.readAsDataURL(file);

    setBackImageUploading(true);
    try {
      const data = new FormData();
      data.append('image', file);
      const response = await api.post('/cards/upload-image', data, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setFormData(prev => ({ ...prev, backImageUrl: response.data.url }));
    } catch (err) {
      setError('Back image upload failed. Please try again.');
      setBackImagePreview(null);
    } finally {
      setBackImageUploading(false);
    }
  };

  // Validate Step 1 before allowing to proceed
  const validateStep1 = () => {
    if (!formData.name.trim()) {
      setError('Card name is required');
      return false;
    }
    if (!formData.tcgGame) {
      setError('Please select a card game');
      return false;
    }
    if (!formData.condition) {
      setError('Please select a condition');
      return false;
    }
    if (!formData.imageUrl) {
      setError('Please upload a front photo');
      return false;
    }
    if (!formData.backImageUrl) {
      setError('Please upload a back photo');
      return false;
    }
    setError('');
    return true;
  };

  // Validate Step 2 before submitting
  const validateStep2 = () => {
    const startingBid = parseFloat(formData.startingBid);
    if (!formData.startingBid || startingBid <= 0) {
      setError('Please enter a valid starting bid');
      return false;
    }
    if (formData.reservePrice) {
      const reserve = parseFloat(formData.reservePrice);
      if (reserve <= startingBid) {
        setError('Reserve price must be greater than the starting bid');
        return false;
      }
      if (formData.buyoutPrice && reserve >= parseFloat(formData.buyoutPrice)) {
        setError('Reserve price must be less than the buyout price');
        return false;
      }
    }
    if (formData.buyoutPrice) {
      const buyout = parseFloat(formData.buyoutPrice);
      if (buyout <= startingBid) {
        setError('Buyout price must be greater than the starting bid');
        return false;
      }
    }
    setError('');
    return true;
  };

  // Move to next step
  const handleNextStep = () => {
    if (validateStep1()) {
      setStep(2);
      window.scrollTo(0, 0); // Scroll to top
    }
  };

  // Final form submission - sends data to backend
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validateStep2()) return;

    setLoading(true);
    setError('');

    try {
      // Call backend: POST /api/cards
      // cardService.createCard sends our formData to the API
      const newCard = await cardService.createCard({
        name: formData.name,
        tcgGame: formData.tcgGame,
        set: formData.set,
        rarity: formData.rarity,
        condition: formData.condition,
        grading: formData.grading,
        description: formData.description,
        imageUrl: formData.imageUrl,
        backImageUrl: formData.backImageUrl || null,
        startingBid: parseFloat(formData.startingBid),
        reservePrice: formData.reservePrice ? parseFloat(formData.reservePrice) : null,
        buyoutPrice: formData.buyoutPrice ? parseFloat(formData.buyoutPrice) : null,
        auctionDurationSeconds: parseInt(formData.auctionDurationSeconds) || 60,
      });

      // Success! Redirect to the new card's detail page
      navigate(`/card/${newCard.id}`);

    } catch (err) {
      setError(err.response?.data?.message || 'Failed to create listing. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // ── RENDER ─────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-gray-950 py-12 px-4">
      <div className="max-w-2xl mx-auto">

        {/* ── HEADER ── */}
        <div className="mb-10">
          <Link
            to="/"
            className="text-gray-500 hover:text-gray-300 text-sm flex items-center gap-2 mb-6 transition-colors"
          >
            ← Back to Home
          </Link>
          <h1 className="text-3xl font-black text-white">List a Card</h1>
          <p className="text-gray-500 mt-2">Fill in your card details to create a listing</p>
        </div>

        {/* ── STEP INDICATOR ── */}
        {/* Shows which step user is on */}
        <div className="flex items-center gap-4 mb-10">
          {/* Step 1 indicator */}
          <div className="flex items-center gap-3">
            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold transition-all ${
              step >= 1
                ? 'bg-violet-600 text-white'      // Active/completed = purple
                : 'bg-gray-800 text-gray-500'     // Inactive = gray
            }`}>
              {step > 1 ? '✓' : '1'}
            </div>
            <span className={`text-sm font-medium ${step >= 1 ? 'text-white' : 'text-gray-500'}`}>
              Card Details
            </span>
          </div>

          {/* Line connecting steps */}
          <div className={`flex-1 h-px transition-all ${step >= 2 ? 'bg-violet-600' : 'bg-gray-800'}`} />

          {/* Step 2 indicator */}
          <div className="flex items-center gap-3">
            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold transition-all ${
              step >= 2 ? 'bg-violet-600 text-white' : 'bg-gray-800 text-gray-500'
            }`}>
              2
            </div>
            <span className={`text-sm font-medium ${step >= 2 ? 'text-white' : 'text-gray-500'}`}>
              Pricing
            </span>
          </div>
        </div>

        {/* ── ERROR MESSAGE ── */}
        {error && (
          <div className="flex items-center gap-3 bg-red-500/10 border border-red-500/20 text-red-400 px-4 py-3 rounded-xl mb-6 text-sm">
            <span>⚠️</span>
            <span>{error}</span>
          </div>
        )}

        {/* ── STEP 1: CARD DETAILS ── */}
        {/* {step === 1 && <div>} means: ONLY show this if we're on step 1 */}
        {step === 1 && (
          <div className="bg-gray-900 border border-gray-800 rounded-2xl p-8 space-y-6">

            {/* Card Name */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Card Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => handleChange('name', e.target.value)}
                placeholder="e.g. Charizard, Pikachu, Mewtwo..."
                className="w-full bg-gray-800 border border-gray-700 text-white rounded-xl px-4 py-3 text-sm placeholder-gray-600 focus:outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-500/20 transition-all"
              />
            </div>

            {/* Card Game */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Card Game <span className="text-red-500">*</span>
              </label>
              <select
                value={formData.tcgGame}
                onChange={(e) => handleChange('tcgGame', e.target.value)}
                className="w-full bg-gray-800 border border-gray-700 text-white rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-500/20 transition-all"
              >
                <option value="">Select card game...</option>
                {TCG_GAMES.map((game) => (
                  <option key={game.value} value={game.value}>{game.label}</option>
                ))}
              </select>
            </div>

            {/* Set Name */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Set / Edition
              </label>
              <input
                type="text"
                value={formData.set}
                onChange={(e) => handleChange('set', e.target.value)}
                placeholder="e.g. Base Set, Scarlet & Violet, Celebrations..."
                className="w-full bg-gray-800 border border-gray-700 text-white rounded-xl px-4 py-3 text-sm placeholder-gray-600 focus:outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-500/20 transition-all"
              />
            </div>

            {/* Rarity - Dropdown (select element) */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Rarity
              </label>
              <select
                value={formData.rarity}
                onChange={(e) => handleChange('rarity', e.target.value)}
                className="w-full bg-gray-800 border border-gray-700 text-white rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-500/20 transition-all"
              >
                <option value="">Select rarity...</option>
                {/* .map() loops through RARITIES array and creates an option for each */}
                {RARITIES.map((rarity) => (
                  <option key={rarity} value={rarity}>{rarity}</option>
                ))}
              </select>
            </div>

            {/* Condition - Radio button style cards */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-3">
                Condition <span className="text-red-500">*</span>
              </label>
              <div className="grid grid-cols-2 gap-3">
                {CONDITIONS.map((condition) => (
                  <button
                    key={condition.value}
                    type="button"
                    onClick={() => handleChange('condition', condition.value)}
                    className={`text-left p-4 rounded-xl border-2 transition-all ${
                      formData.condition === condition.value
                        ? 'border-violet-500 bg-violet-500/10 text-white'  // Selected state
                        : 'border-gray-700 bg-gray-800 text-gray-400 hover:border-gray-600'  // Unselected
                    }`}
                  >
                    <div className="font-semibold text-sm">{condition.label}</div>
                    <div className="text-xs mt-1 opacity-70">{condition.desc}</div>
                  </button>
                ))}
              </div>
            </div>

            {/* Grading (optional) */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Professional Grading
                <span className="text-gray-600 font-normal ml-2"> (leave blank if ungraded)</span>
              </label>
              <input
                type="text"
                value={formData.grading}
                onChange={(e) => handleChange('grading', e.target.value)}
                placeholder="e.g. PSA 10, BGS 10, CGC 10..."
                className="w-full bg-gray-800 border border-gray-700 text-white rounded-xl px-4 py-3 text-sm placeholder-gray-600 focus:outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-500/20 transition-all"
              />
            </div>

            {/* Description */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Description
                <span className="text-gray-600 font-normal ml-2">(optional)</span>
              </label>
              <textarea
                value={formData.description}
                onChange={(e) => handleChange('description', e.target.value)}
                placeholder="Describe the card's condition, any defects, why it's special..."
                rows={4}
                className="w-full bg-gray-800 border border-gray-700 text-white rounded-xl px-4 py-3 text-sm placeholder-gray-600 focus:outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-500/20 transition-all resize-none"
              />
            </div>

            {/* Image Upload */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-3">
                Card Photos
              </label>
              <div className="grid grid-cols-2 gap-4">

                {/* Front */}
                <div>
                  <p className="text-xs text-gray-500 mb-2 font-medium">FRONT</p>
                  {imagePreview ? (
                    <div className="relative aspect-[3/4]">
                      <img src={imagePreview} alt="Front" className="w-full h-full object-contain bg-gray-800 rounded-xl" />
                      {imageUploading && (
                        <div className="absolute inset-0 bg-black/50 rounded-xl flex items-center justify-center">
                          <svg className="animate-spin h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                          </svg>
                        </div>
                      )}
                      {!imageUploading && (
                        <button type="button" onClick={() => { setImagePreview(null); handleChange('imageUrl', ''); }}
                          className="absolute top-2 right-2 bg-red-600 hover:bg-red-500 text-white w-7 h-7 rounded-full flex items-center justify-center text-xs transition-all">
                          ✕
                        </button>
                      )}
                    </div>
                  ) : (
                    <label className="cursor-pointer block">
                      <div className="border-2 border-dashed border-gray-700 rounded-xl aspect-[3/4] flex flex-col items-center justify-center hover:border-violet-500/50 transition-colors bg-gray-800/30">
                        <div className="text-3xl mb-2">📷</div>
                        <p className="text-gray-500 text-xs text-center px-2">Click to upload front</p>
                      </div>
                      <input type="file" accept="image/*" onChange={handleImageChange} className="hidden" />
                    </label>
                  )}
                </div>

                {/* Back */}
                <div>
                  <p className="text-xs text-gray-500 mb-2 font-medium">BACK</p>
                  {backImagePreview ? (
                    <div className="relative aspect-[3/4]">
                      <img src={backImagePreview} alt="Back" className="w-full h-full object-contain bg-gray-800 rounded-xl" />
                      {backImageUploading && (
                        <div className="absolute inset-0 bg-black/50 rounded-xl flex items-center justify-center">
                          <svg className="animate-spin h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                          </svg>
                        </div>
                      )}
                      {!backImageUploading && (
                        <button type="button" onClick={() => { setBackImagePreview(null); handleChange('backImageUrl', ''); }}
                          className="absolute top-2 right-2 bg-red-600 hover:bg-red-500 text-white w-7 h-7 rounded-full flex items-center justify-center text-xs transition-all">
                          ✕
                        </button>
                      )}
                    </div>
                  ) : (
                    <label className="cursor-pointer block">
                      <div className="border-2 border-dashed border-gray-700 rounded-xl aspect-[3/4] flex flex-col items-center justify-center hover:border-violet-500/50 transition-colors bg-gray-800/30">
                        <div className="text-3xl mb-2">📷</div>
                        <p className="text-gray-500 text-xs text-center px-2">Click to upload back</p>
                      </div>
                      <input type="file" accept="image/*" onChange={handleBackImageChange} className="hidden" />
                    </label>
                  )}
                </div>

              </div>
            </div>

            {/* Next button */}
            <button
              type="button"
              onClick={handleNextStep}
              disabled={imageUploading || backImageUploading}
              className="w-full bg-violet-600 hover:bg-violet-500 disabled:opacity-50 disabled:cursor-not-allowed text-white py-3 rounded-xl font-bold transition-all hover:scale-[1.02]"
            >
              {(imageUploading || backImageUploading) ? 'Uploading image...' : 'Continue to Pricing →'}
            </button>
          </div>
        )}

        {/* ── STEP 2: PRICING ── */}
        {step === 2 && (
          <div className="bg-gray-900 border border-gray-800 rounded-2xl p-8 space-y-6">

            {/* Preview of what they're listing */}
            <div className="flex items-center gap-4 pb-6 border-b border-gray-800">
              {/* Card thumbnail */}
              <div className="w-16 h-16 rounded-lg bg-gray-800 overflow-hidden flex-shrink-0">
                {imagePreview ? (
                  <img src={imagePreview} alt={formData.name} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-2xl">🎴</div>
                )}
              </div>
              {/* Card info summary */}
              <div>
                <h3 className="font-bold text-white">{formData.name || 'Unnamed Card'}</h3>
                <p className="text-gray-500 text-sm">
                  {[formData.set, formData.rarity, formData.condition].filter(Boolean).join(' · ')}
                </p>
              </div>
            </div>

            {/* Starting Bid */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Starting Bid (USD) <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                {/* Dollar sign prefix */}
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 font-bold">$</span>
                <input
                  type="number"
                  min="0.01"
                  step="0.01"
                  value={formData.startingBid}
                  onChange={(e) => handleChange('startingBid', e.target.value)}
                  placeholder="0.00"
                  className="w-full bg-gray-800 border border-gray-700 text-white rounded-xl pl-8 pr-4 py-3 text-sm placeholder-gray-600 focus:outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-500/20 transition-all"
                />
              </div>
              <p className="text-gray-600 text-xs mt-2">
                This is the minimum bid. Viewers will bid higher to win.
              </p>
            </div>

            {/* Reserve Price */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Reserve Price
                <span className="text-gray-600 font-normal ml-2">(optional)</span>
              </label>
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 font-bold">$</span>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={formData.reservePrice}
                  onChange={(e) => handleChange('reservePrice', e.target.value)}
                  placeholder="0.00"
                  className="w-full bg-gray-800 border border-gray-700 text-white rounded-xl pl-8 pr-4 py-3 text-sm placeholder-gray-600 focus:outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-500/20 transition-all"
                />
              </div>
              <p className="text-gray-600 text-xs mt-2">
                Minimum price you'll accept. If the highest bid doesn't reach this, no sale occurs and the card is re-queued.
              </p>
            </div>

            {/* Buyout Price */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Buyout Price (optional)
              </label>
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 font-bold">$</span>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={formData.buyoutPrice}
                  onChange={(e) => handleChange('buyoutPrice', e.target.value)}
                  placeholder="0.00"
                  className="w-full bg-gray-800 border border-gray-700 text-white rounded-xl pl-8 pr-4 py-3 text-sm placeholder-gray-600 focus:outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-500/20 transition-all"
                />
              </div>
              <p className="text-gray-600 text-xs mt-2">
                Allows a buyer to purchase instantly at this price during the auction.
              </p>
            </div>

            {/* Auction Duration */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Auction Duration
              </label>
              <select
                value={['30','45','60','90','120'].includes(formData.auctionDurationSeconds) ? formData.auctionDurationSeconds : 'custom'}
                onChange={(e) => handleChange('auctionDurationSeconds', e.target.value === 'custom' ? '' : e.target.value)}
                className="w-full bg-gray-800 border border-gray-700 text-white rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-500/20 transition-all"
              >
                <option value="30">30 seconds</option>
                <option value="45">45 seconds</option>
                <option value="60">60 seconds (default)</option>
                <option value="90">90 seconds</option>
                <option value="120">2 minutes</option>
                <option value="custom">Custom...</option>
              </select>
              {!['30','45','60','90','120'].includes(formData.auctionDurationSeconds) && (
                <input
                  type="number"
                  min="10"
                  max="600"
                  value={formData.auctionDurationSeconds}
                  onChange={(e) => handleChange('auctionDurationSeconds', e.target.value)}
                  placeholder="Enter duration in seconds (e.g. 75)"
                  className="mt-2 w-full bg-gray-800 border border-gray-700 text-white rounded-xl px-4 py-3 text-sm placeholder-gray-600 focus:outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-500/20 transition-all"
                />
              )}
            </div>

            {/* Pricing tips */}
            <div className="bg-gray-800/50 rounded-xl p-4 space-y-2">
              <p className="text-sm font-medium text-gray-300">💡 Pricing Tips</p>
              <ul className="text-xs text-gray-500 space-y-1">
                <li>• Start low to attract more bidders and drive up competition</li>
                <li>• Research recent sales on eBay or TCGPlayer for fair market value</li>
                <li>• PSA/BGS graded cards typically sell for 2-5x raw card prices</li>
                <li>• Base Set holos are currently in high demand</li>
              </ul>
            </div>

            {/* What happens next info */}
            <div className="bg-violet-500/10 border border-violet-500/20 rounded-xl p-4">
              <p className="text-sm font-medium text-violet-300 mb-2">What happens next?</p>
              <p className="text-xs text-gray-400 leading-relaxed">
                After listing, your card will appear on the homepage. During a livestream,
                you can start an auction for this card and viewers will bid in real-time.
                The highest bidder wins and you'll be connected to arrange payment and shipping.
              </p>
            </div>

            {/* Buttons */}
            <div className="flex gap-4 pt-2">
              {/* Back button */}
              <button
                type="button"
                onClick={() => {
                  setStep(1);
                  setError('');
                }}
                className="flex-1 bg-gray-800 hover:bg-gray-700 border border-gray-700 text-white py-3 rounded-xl font-bold transition-all"
              >
                ← Back
              </button>

              {/* Submit button */}
              <button
                type="button"
                onClick={handleSubmit}
                disabled={loading}
                className="flex-2 flex-1 bg-violet-600 hover:bg-violet-500 disabled:opacity-50 disabled:cursor-not-allowed text-white py-3 rounded-xl font-bold transition-all hover:scale-[1.02] hover:shadow-lg hover:shadow-violet-500/25"
              >
                {loading ? (
                  <span className="flex items-center justify-center gap-2">
                    <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                    </svg>
                    Creating Listing...
                  </span>
                ) : (
                  '🎴 Create Listing'
                )}
              </button>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}

export default ListCardPage;
