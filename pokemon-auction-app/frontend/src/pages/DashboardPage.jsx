import React, { useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import OverviewTab from './dashboard/OverviewTab';
import StreamsTab from './dashboard/StreamsTab';
import SalesTab from './dashboard/SalesTab';
import InventoryTab from './dashboard/InventoryTab';

const TABS = [
  { id: 'overview', label: 'Overview' },
  { id: 'streams', label: 'Streams' },
  { id: 'sales', label: 'Sales' },
  { id: 'inventory', label: 'Inventory' },
];

const VALID = TABS.map((t) => t.id);

export default function DashboardPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const tab = useMemo(() => {
    const t = searchParams.get('tab');
    return VALID.includes(t) ? t : 'overview';
  }, [searchParams]);

  const setTab = (id) => {
    const next = new URLSearchParams(searchParams);
    next.set('tab', id);
    setSearchParams(next, { replace: true });
  };

  return (
    <div className="min-h-screen bg-[#0f1419] text-white">
      <div className="max-w-7xl mx-auto p-6">
        <div className="mb-6">
          <h1 className="text-3xl font-black">Seller Dashboard</h1>
          <p className="text-gray-400 mt-1 text-sm">
            Manage your streams, sales, and inventory in one place.
          </p>
        </div>

        <div className="flex gap-1 bg-[#1a1f2e] p-1 rounded-xl w-fit mb-6 overflow-x-auto">
          {TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${
                tab === t.id
                  ? 'bg-violet-600 text-white'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {tab === 'overview' && <OverviewTab onNavigateTab={setTab} />}
        {tab === 'streams' && <StreamsTab />}
        {tab === 'sales' && <SalesTab />}
        {tab === 'inventory' && <InventoryTab />}
      </div>
    </div>
  );
}
