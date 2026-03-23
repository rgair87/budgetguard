import { useEffect, useState } from 'react';
import api from '../api/client';
import type { IncomingEvent } from '@runway/shared';

export default function Events() {
  const [events, setEvents] = useState<IncomingEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState('');
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadEvents();
  }, []);

  async function loadEvents() {
    try {
      const { data } = await api.get('/events');
      setEvents(data);
    } finally {
      setLoading(false);
    }
  }

  async function addEvent(e: React.FormEvent) {
    e.preventDefault();
    if (!name || !amount) return;
    setSaving(true);
    try {
      await api.post('/events', {
        name,
        estimated_amount: parseFloat(amount),
        expected_date: date || null,
      });
      setName('');
      setAmount('');
      setDate('');
      await loadEvents();
    } finally {
      setSaving(false);
    }
  }

  async function deleteEvent(id: string) {
    await api.delete(`/events/${id}`);
    setEvents(events.filter((e) => e.id !== id));
  }

  if (loading) return <div className="text-gray-500 text-center py-12">Loading...</div>;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-gray-900">Incoming Events</h1>
        <p className="text-gray-500 text-sm mt-1">
          Big expenses you know are coming. These factor into your Runway score.
        </p>
      </div>

      {/* Add event form */}
      <form onSubmit={addEvent} className="bg-white rounded-lg border border-gray-200 p-4">
        <div className="grid grid-cols-4 gap-3">
          <input
            placeholder="Event name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            className="col-span-2 border border-gray-300 rounded-md px-3 py-2 text-sm"
          />
          <input
            placeholder="Amount"
            type="number"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            required
            className="border border-gray-300 rounded-md px-3 py-2 text-sm"
          />
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            placeholder="Date (optional)"
            className="border border-gray-300 rounded-md px-3 py-2 text-sm"
          />
        </div>
        <button
          type="submit"
          disabled={saving}
          className="mt-3 bg-indigo-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-indigo-700 disabled:opacity-50"
        >
          {saving ? 'Adding...' : 'Add event'}
        </button>
      </form>

      {/* Event list */}
      {events.length === 0 ? (
        <p className="text-gray-500 text-sm text-center py-8">No upcoming events. Add one above.</p>
      ) : (
        <div className="space-y-2">
          {events.map((evt) => (
            <div key={evt.id} className="bg-white rounded-lg p-4 border border-gray-200 flex items-center justify-between">
              <div>
                <p className="font-medium text-gray-900">{evt.name}</p>
                <p className="text-sm text-gray-500">
                  {evt.expected_date
                    ? new Date(evt.expected_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
                    : 'Anytime'}
                  {evt.is_recurring && ` (${evt.recurrence_interval})`}
                </p>
              </div>
              <div className="flex items-center gap-4">
                <p className="text-lg font-semibold text-gray-900">
                  ${Number(evt.estimated_amount).toLocaleString('en-US', { minimumFractionDigits: 0 })}
                </p>
                <button
                  onClick={() => deleteEvent(evt.id)}
                  className="text-red-500 text-sm hover:text-red-700"
                >
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
