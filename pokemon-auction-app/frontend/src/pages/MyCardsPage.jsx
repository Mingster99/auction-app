import React from 'react';
import MyCardsContent from '../components/inventory/MyCardsContent';

export default function MyCardsPage() {
  return (
    <div className="min-h-screen bg-[#0f1419] text-white">
      <div className="max-w-7xl mx-auto p-6">
        <h1 className="text-3xl font-black mb-6">My Cards</h1>
        <MyCardsContent />
      </div>
    </div>
  );
}
