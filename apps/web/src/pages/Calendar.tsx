import { useEffect, useState, useCallback, useRef } from 'react';
import { Link } from 'react-router-dom';
import api from '../api/client';
import type { CalendarMonth, CalendarDay } from '@spenditure/shared';
import {
  ChevronLeft,
  ChevronRight,
  Plus,
  Calendar as CalendarIcon,
  Download,
  X,
} from 'lucide-react';
import useTier from '../hooks/useTier';
import useTrack from '../hooks/useTrack';

const DAY_NAMES = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

function fmt(n: number): string {
  return n.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

function generateICS(data: CalendarMonth, monthLabel: string): string {
  const lines: string[] = ['BEGIN:VCALENDAR', 'VERSION:2.0', `PRODID:-//Spenditure//Financial Calendar//EN`, `X-WR-CALNAME:Spenditure - ${monthLabel}`];
  const datestamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
  data.days.forEach(day => {
    const dt = day.date.replace(/-/g, '');
    if (day.isPayday) lines.push('BEGIN:VEVENT', `DTSTART;VALUE=DATE:${dt}`, `DTSTAMP:${datestamp}`, `UID:pay-${day.date}@spenditure`, `SUMMARY:Payday +$${fmt(day.incomeAmount)}`, 'END:VEVENT');
    day.events.forEach((ev, i) => lines.push('BEGIN:VEVENT', `DTSTART;VALUE=DATE:${dt}`, `DTSTAMP:${datestamp}`, `UID:ev-${day.date}-${i}@spenditure`, `SUMMARY:${ev.name} -$${fmt(ev.amount)}`, 'END:VEVENT'));
  });
  lines.push('END:VCALENDAR');
  return lines.join('\r\n');
}

function downloadFile(content: string, filename: string, mime: string) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click();
  document.body.removeChild(a); URL.revokeObjectURL(url);
}

export default function Calendar() {
  const { tier } = useTier();
  const track = useTrack('calendar');
  const [data, setData] = useState<CalendarMonth | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentMonth, setCurrentMonth] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  });

  const [selectedDay, setSelectedDay] = useState<CalendarDay | null>(null);

  // What-if state
  const [whatIfAmount, setWhatIfAmount] = useState('');

  // Add expense state
  const [showAddForm, setShowAddForm] = useState(false);
  const [newEventName, setNewEventName] = useState('');
  const [newEventAmount, setNewEventAmount] = useState('');
  const [saving, setSaving] = useState(false);

  // Export
  const [exportOpen, setExportOpen] = useState(false);
  const exportRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!exportOpen) return;
    const handler = (e: MouseEvent) => { if (exportRef.current && !exportRef.current.contains(e.target as Node)) setExportOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [exportOpen]);

  const fetchCalendar = useCallback(() => {
    setLoading(true);
    setError(null);
    api.get(`/runway/calendar?month=${currentMonth}`)
      .then(r => {
        setData(r.data);
        // Auto-select today or first day
        const today = new Date().toISOString().split('T')[0];
        const todayDay = r.data.days.find((d: CalendarDay) => d.date === today);
        setSelectedDay(todayDay || r.data.days[0] || null);
      })
      .catch(() => setError('Could not load calendar data'))
      .finally(() => setLoading(false));
  }, [currentMonth]);

  useEffect(() => { fetchCalendar(); }, [fetchCalendar]);

  useEffect(() => {
    if (selectedDay && data) {
      const updated = data.days.find(d => d.date === selectedDay.date);
      if (updated) setSelectedDay(updated);
    }
  }, [data]);

  function navigateMonth(delta: number) {
    const [y, m] = currentMonth.split('-').map(Number);
    const d = new Date(y, m - 1 + delta, 1);
    setCurrentMonth(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
    setWhatIfAmount('');
  }

  async function handleAddEvent() {
    if (!newEventName.trim() || !newEventAmount.trim() || !selectedDay) return;
    track('calendar', 'add_expense');
    setSaving(true);
    try {
      await api.post('/events', { name: newEventName.trim(), estimated_amount: parseFloat(newEventAmount), expected_date: selectedDay.date });
      setNewEventName(''); setNewEventAmount(''); setShowAddForm(false);
      fetchCalendar();
    } catch {} finally { setSaving(false); }
  }

  // What-if calculations (client-side, instant)
  const whatIfNum = parseFloat(whatIfAmount) || 0;
  const whatIfDays = selectedDay && data && whatIfNum > 0
    ? data.days.map(d => {
        if (d.date >= selectedDay.date) {
          return { ...d, projectedBalance: d.projectedBalance - whatIfNum };
        }
        return d;
      })
    : null;

  const whatIfEndOfMonth = whatIfDays ? whatIfDays[whatIfDays.length - 1]?.projectedBalance : null;
  const normalEndOfMonth = data ? data.days[data.days.length - 1]?.projectedBalance : null;
  const whatIfDangerDay = whatIfDays?.find(d => d.projectedBalance < 0 && d.date >= (selectedDay?.date || ''));

  const today = new Date();
  const maxMonth = `${today.getFullYear()}-${String(today.getMonth() + 7).padStart(2, '0')}`;
  const canGoForward = currentMonth < maxMonth;
  const monthLabel = (() => {
    const [y, m] = currentMonth.split('-').map(Number);
    return new Date(y, m - 1, 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  })();

  if (loading) return (
    <div className="flex items-center justify-center py-20">
      <div className="w-8 h-8 border-2 border-indigo-200 border-t-indigo-600 rounded-full animate-spin" />
    </div>
  );
  if (error) return <div className="bg-white border border-red-200 rounded-2xl p-5 text-sm text-red-600">{error}</div>;
  if (!data) return null;

  const [yr, mn] = currentMonth.split('-').map(Number);
  const firstDayOfWeek = new Date(yr, mn - 1, 1).getDay();
  const daysInMonth = data.days.length;
  const remainingDays = Math.max(1, daysInMonth - today.getDate() + 1);
  const dailyBudget = data.monthlyBudget > 0 ? Math.round((data.monthlyBudget - data.spentSoFar) / remainingDays) : 0;

  // Use what-if days for display if active
  const displayDays = whatIfDays || data.days;

  return (
    <div className="space-y-4">
      {/* Summary bar */}
      <div className="bg-white rounded-2xl border border-slate-200/60 shadow-sm">
        <div className="flex items-center justify-between px-5 py-3">
          <button onClick={() => navigateMonth(-1)} className="p-2 rounded-xl hover:bg-slate-100 text-slate-500 transition-all" aria-label="Previous month">
            <ChevronLeft className="w-4 h-4" />
          </button>
          <h1 className="text-base font-semibold text-slate-900">{monthLabel}</h1>
          <div className="flex items-center gap-1">
            <div className="relative" ref={exportRef}>
              <button onClick={() => setExportOpen(v => !v)} className="p-2 rounded-xl hover:bg-slate-100 text-slate-400 transition-all" aria-label="Export">
                <Download className="w-4 h-4" />
              </button>
              {exportOpen && (
                <div className="absolute right-0 top-full mt-1 z-50 w-40 bg-white rounded-xl shadow-lg border border-slate-200 py-1">
                  <button onClick={() => { downloadFile(generateICS(data, monthLabel), `spenditure-${currentMonth}.ics`, 'text/calendar'); setExportOpen(false); }} className="w-full text-left px-3 py-2 text-xs text-slate-700 hover:bg-slate-50">Download .ics</button>
                </div>
              )}
            </div>
            {!canGoForward && tier === 'free' && (
              <Link to="/pricing" className="text-[10px] font-medium text-indigo-600 hover:text-indigo-700 ml-1">See further</Link>
            )}
            <button onClick={() => navigateMonth(1)} disabled={!canGoForward} className={`p-2 rounded-xl transition-all ${canGoForward ? 'hover:bg-slate-100 text-slate-500' : 'text-slate-200'}`} aria-label="Next month">
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
        {/* Stats row */}
        <div className="grid grid-cols-3 border-t border-slate-100">
          <div className="px-4 py-3 text-center border-r border-slate-100">
            <p className="text-xs text-slate-500">Left to spend</p>
            <p className="text-base font-bold text-emerald-700">${fmt(Math.max(0, data.monthlyBudget - data.spentSoFar))}</p>
          </div>
          <div className="px-4 py-3 text-center border-r border-slate-100">
            <p className="text-xs text-slate-500">Spent</p>
            <p className="text-base font-bold text-slate-900">${fmt(data.spentSoFar)}</p>
          </div>
          <div className="px-4 py-3 text-center">
            <p className="text-xs text-slate-500">End of month</p>
            <p className={`text-base font-bold ${(whatIfEndOfMonth ?? normalEndOfMonth ?? 0) < 0 ? 'text-red-600' : 'text-slate-900'}`}>
              ${fmt(whatIfEndOfMonth ?? normalEndOfMonth ?? 0)}
            </p>
          </div>
        </div>
      </div>

      {/* Split view: Calendar grid + Detail panel */}
      <div className="flex gap-5 flex-col lg:flex-row">
        {/* Left: Calendar grid */}
        <div className="lg:flex-1">
          <div className="bg-white rounded-2xl border border-slate-200/60 shadow-sm overflow-hidden">
            {/* Day headers */}
            <div className="grid grid-cols-7 border-b border-slate-100">
              {DAY_NAMES.map((d, i) => (
                <div key={i} className="text-center text-[11px] font-semibold text-slate-400 py-3 uppercase tracking-wider">{d}</div>
              ))}
            </div>

            {/* Day cells */}
            <div className="grid grid-cols-7">
              {/* Leading empty cells */}
              {Array.from({ length: firstDayOfWeek }).map((_, i) => (
                <div key={`e-${i}`} className="h-[72px] border-b border-r border-slate-50/80" />
              ))}

              {displayDays.map((day, idx) => {
                const dayNum = idx + 1;
                const isSelected = selectedDay?.date === day.date;
                const isDanger = day.projectedBalance < 200;
                const isNegative = day.projectedBalance < 0;

                return (
                  <button
                    key={day.date}
                    onClick={() => { setSelectedDay(day); setWhatIfAmount(''); setShowAddForm(false); }}
                    className={`relative h-[72px] p-1.5 border-b border-r border-slate-50/80 text-left transition-all duration-150
                      ${day.isPast ? 'opacity-25' : ''}
                      ${isSelected ? 'bg-indigo-50 ring-2 ring-inset ring-indigo-400' : 'hover:bg-slate-50'}
                      ${isNegative && !day.isPast ? 'bg-red-50/60' : isDanger && !day.isPast ? 'bg-amber-50/40' : ''}
                    `}
                  >
                    {/* Day number */}
                    <span className={`text-[11px] font-semibold block ${
                      day.isToday ? 'bg-indigo-600 text-white w-5 h-5 rounded-full flex items-center justify-center text-[10px] mx-auto'
                      : isSelected ? 'text-indigo-600' : 'text-slate-600'
                    }`}>{dayNum}</span>

                    {/* Icons row */}
                    {!day.isPast && (
                      <div className="flex items-center gap-1 mt-1 justify-center">
                        {day.isPayday && <span className="text-[10px]" title="Payday">💰</span>}
                        {day.events.length > 0 && <span className="text-[10px]" title={`${day.events.length} bill${day.events.length > 1 ? 's' : ''}`}>📄</span>}
                        {isNegative && <span className="text-[10px]" title="Negative balance">🔴</span>}
                        {!isNegative && isDanger && <span className="text-[10px]" title="Low balance">⚠️</span>}
                      </div>
                    )}

                    {/* Balance preview */}
                    {!day.isPast && !isNegative && !isDanger && day.events.length === 0 && !day.isPayday && (
                      <p className="text-[9px] text-slate-300 text-center mt-1">${(day.projectedBalance / 1000).toFixed(0)}k</p>
                    )}
                  </button>
                );
              })}

              {/* Trailing empties */}
              {(() => {
                const total = firstDayOfWeek + daysInMonth;
                const trail = total % 7 === 0 ? 0 : 7 - (total % 7);
                return Array.from({ length: trail }).map((_, i) => (
                  <div key={`t-${i}`} className="h-[72px] border-b border-r border-slate-50/80" />
                ));
              })()}
            </div>

            {/* Legend */}
            <div className="flex items-center justify-center gap-5 py-2.5 border-t border-slate-100 bg-slate-50/50">
              <span className="flex items-center gap-1 text-[10px] text-slate-400">💰 Payday</span>
              <span className="flex items-center gap-1 text-[10px] text-slate-400">📄 Bills</span>
              <span className="flex items-center gap-1 text-[10px] text-slate-400">⚠️ Watch</span>
              <span className="flex items-center gap-1 text-[10px] text-slate-400">🔴 Low</span>
            </div>
          </div>
        </div>

        {/* Right: Day detail panel */}
        <div className="lg:w-[380px] shrink-0">
          {selectedDay ? (
            <div className="bg-white rounded-2xl border border-slate-200/60 shadow-lg p-5 space-y-5">
              {/* Date header */}
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-lg font-semibold text-slate-900">
                    {new Date(selectedDay.date + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
                  </p>
                  {selectedDay.isToday && <span className="text-[10px] font-semibold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-full">Today</span>}
                </div>
              </div>

              {/* Projected balance */}
              <div>
                <p className="text-xs text-slate-500 uppercase tracking-wider mb-1">Projected Balance</p>
                <p className={`text-3xl font-bold ${
                  (whatIfNum > 0 ? selectedDay.projectedBalance - whatIfNum : selectedDay.projectedBalance) < 0 ? 'text-red-600' :
                  (whatIfNum > 0 ? selectedDay.projectedBalance - whatIfNum : selectedDay.projectedBalance) < 500 ? 'text-amber-600' :
                  'text-slate-900'
                }`}>
                  ${fmt(whatIfNum > 0 ? selectedDay.projectedBalance - whatIfNum : selectedDay.projectedBalance)}
                </p>
              </div>

              {/* What-if */}
              {!selectedDay.isPast && (
                <div className="bg-slate-50 rounded-xl border border-slate-200/60 p-4 space-y-3">
                  <p className="text-xs font-semibold text-slate-600">What if I spend...</p>
                  <div className="relative">
                    <span className="absolute left-3 top-2.5 text-sm text-slate-400">$</span>
                    <input
                      type="number"
                      value={whatIfAmount}
                      onChange={e => setWhatIfAmount(e.target.value)}
                      placeholder="Enter amount"
                      className="w-full text-sm border border-slate-200 rounded-lg bg-white pl-7 pr-3 py-2.5 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 outline-none transition-all"
                    />
                  </div>
                  {whatIfNum > 0 && (
                    <div className="space-y-1.5">
                      <div className="flex justify-between text-xs">
                        <span className="text-slate-500">Balance after</span>
                        <span className={`font-semibold ${selectedDay.projectedBalance - whatIfNum < 0 ? 'text-red-600' : 'text-slate-800'}`}>
                          ${fmt(selectedDay.projectedBalance - whatIfNum)}
                        </span>
                      </div>
                      <div className="flex justify-between text-xs">
                        <span className="text-slate-500">End of month</span>
                        <span className={`font-semibold ${(whatIfEndOfMonth ?? 0) < 0 ? 'text-red-600' : 'text-slate-800'}`}>
                          ${fmt(whatIfEndOfMonth ?? 0)}
                          <span className="text-slate-400 font-normal ml-1">(was ${fmt(normalEndOfMonth ?? 0)})</span>
                        </span>
                      </div>
                      {whatIfDangerDay && (
                        <p className="text-xs font-medium text-red-600 bg-red-50 rounded-lg px-3 py-2">
                          This would put you negative on {new Date(whatIfDangerDay.date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                        </p>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* Income */}
              {selectedDay.isPayday && (
                <div className="flex items-center gap-3 bg-emerald-50 border border-emerald-200/60 rounded-xl px-4 py-3">
                  <div className="w-2 h-8 rounded-full bg-emerald-500" />
                  <div>
                    <p className="text-xs text-emerald-600 font-medium">Income</p>
                    <p className="text-base font-bold text-emerald-700">+${fmt(selectedDay.incomeAmount)}</p>
                  </div>
                </div>
              )}

              {/* Bills & Events */}
              {selectedDay.events.length > 0 && (
                <div>
                  <p className="text-xs text-slate-500 uppercase tracking-wider mb-2">Bills & Expenses</p>
                  <div className="space-y-1.5">
                    {selectedDay.events.map((ev, i) => (
                      <div key={i} className="flex items-center justify-between bg-slate-50 rounded-lg px-3 py-2.5 border-l-2 border-orange-400">
                        <span className="text-sm text-slate-700" title={ev.name}>{ev.name}</span>
                        <span className="text-sm font-semibold text-slate-900">-${fmt(ev.amount)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Daily budget */}
              {dailyBudget > 0 && !selectedDay.isPast && (
                <div className="flex items-center gap-3 border-l-2 border-emerald-500 pl-3">
                  <div>
                    <p className="text-xs text-slate-500">Daily budget</p>
                    <p className="text-lg font-bold text-slate-900">${fmt(dailyBudget)}</p>
                    <p className="text-[10px] text-slate-400">Spend up to this and stay on track</p>
                  </div>
                </div>
              )}

              {/* Add real expense */}
              {!selectedDay.isPast && (
                <div>
                  {showAddForm ? (
                    <div className="space-y-2 bg-slate-50 rounded-xl p-3 border border-slate-200/60">
                      <input value={newEventName} onChange={e => setNewEventName(e.target.value)} placeholder="Expense name"
                        className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 focus:ring-2 focus:ring-indigo-500/20 outline-none" />
                      <div className="flex gap-2">
                        <div className="relative flex-1">
                          <span className="absolute left-3 top-2 text-sm text-slate-400">$</span>
                          <input type="number" value={newEventAmount} onChange={e => setNewEventAmount(e.target.value)} placeholder="Amount"
                            className="w-full text-sm border border-slate-200 rounded-lg pl-7 pr-3 py-2 focus:ring-2 focus:ring-indigo-500/20 outline-none" />
                        </div>
                        <button onClick={handleAddEvent} disabled={saving || !newEventName || !newEventAmount}
                          className="text-xs font-medium text-white bg-indigo-600 hover:bg-indigo-700 px-3 py-2 rounded-lg disabled:opacity-40 transition-colors">
                          {saving ? 'Adding...' : 'Add'}
                        </button>
                        <button onClick={() => setShowAddForm(false)} className="text-xs text-slate-400 hover:text-slate-600 px-2">
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ) : (
                    <button onClick={() => setShowAddForm(true)}
                      className="w-full text-sm text-slate-500 hover:text-indigo-600 bg-slate-50 hover:bg-indigo-50 border border-slate-200/60 hover:border-indigo-200 rounded-xl py-2.5 transition-all flex items-center justify-center gap-1.5">
                      <Plus className="w-3.5 h-3.5" /> Add expense on this day
                    </button>
                  )}
                </div>
              )}
            </div>
          ) : (
            <div className="bg-white rounded-2xl border border-slate-200/60 shadow-sm p-8 text-center text-slate-400">
              <CalendarIcon className="w-8 h-8 mx-auto mb-2 text-slate-300" />
              <p className="text-sm">Select a day to see details</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
