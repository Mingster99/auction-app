import React, { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { streamService } from '../../services/streamService';

export default function ScheduleStreamModal({ open, onClose, onScheduled }) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [scheduledStartTime, setScheduledStartTime] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!open) return;
    setTitle('');
    setDescription('');
    setScheduledStartTime('');
    setError('');
    setSubmitting(false);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const handleKey = (e) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [open, onClose]);

  if (!open) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!title.trim()) {
      setError('Title is required');
      return;
    }
    if (!scheduledStartTime) {
      setError('Start time is required');
      return;
    }
    const startMs = new Date(scheduledStartTime).getTime();
    if (Number.isNaN(startMs) || startMs <= Date.now()) {
      setError('Start time must be in the future');
      return;
    }

    setSubmitting(true);
    try {
      const res = await streamService.scheduleStream({
        title: title.trim(),
        description: description.trim() || null,
        scheduled_start_time: new Date(scheduledStartTime).toISOString(),
      });
      const newStream = res?.data || res;
      toast.success('Stream scheduled');
      onScheduled?.(newStream);
      onClose();
    } catch (err) {
      const message = err.response?.data?.message || 'Failed to schedule stream';
      setError(message);
      toast.error(message);
    } finally {
      setSubmitting(false);
    }
  };

  // datetime-local needs `YYYY-MM-DDTHH:mm` with no timezone — give a sensible min of now+5min
  const minDate = new Date(Date.now() + 5 * 60 * 1000).toISOString().slice(0, 16);

  return (
    <div
      className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-[#1a1f2e] rounded-2xl border border-gray-800 max-w-md w-full"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-5 border-b border-gray-800">
          <h2 className="text-xl font-bold text-white">Schedule a stream</h2>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-white bg-gray-800 hover:bg-gray-700 w-8 h-8 rounded-lg flex items-center justify-center transition-colors"
          >
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div>
            <label className="block text-xs text-gray-400 mb-1.5 font-medium">Title</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Friday Night Raffle Drop"
              maxLength={120}
              className="w-full bg-gray-900 border border-gray-800 rounded-lg px-3 py-2 text-white text-sm focus:border-violet-500 focus:ring-2 focus:ring-violet-500/20 outline-none"
              autoFocus
            />
          </div>

          <div>
            <label className="block text-xs text-gray-400 mb-1.5 font-medium">Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What you'll be auctioning, special guests, etc."
              rows={3}
              maxLength={500}
              className="w-full bg-gray-900 border border-gray-800 rounded-lg px-3 py-2 text-white text-sm focus:border-violet-500 focus:ring-2 focus:ring-violet-500/20 outline-none resize-none"
            />
          </div>

          <div>
            <label className="block text-xs text-gray-400 mb-1.5 font-medium">Start time</label>
            <input
              type="datetime-local"
              value={scheduledStartTime}
              min={minDate}
              onChange={(e) => setScheduledStartTime(e.target.value)}
              className="w-full bg-gray-900 border border-gray-800 rounded-lg px-3 py-2 text-white text-sm focus:border-violet-500 focus:ring-2 focus:ring-violet-500/20 outline-none"
            />
            <p className="text-xs text-gray-500 mt-1">Local time. Subscribers will be notified when you go live.</p>
          </div>

          {error && (
            <div className="bg-red-500/20 border border-red-500/50 text-red-300 text-sm p-3 rounded-lg">
              {error}
            </div>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-gray-400 hover:text-white text-sm font-medium transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="bg-violet-600 hover:bg-violet-700 text-white font-bold px-5 py-2 rounded-xl text-sm transition-colors disabled:opacity-50"
            >
              {submitting ? 'Scheduling…' : 'Schedule stream'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
