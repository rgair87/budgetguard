import { useEffect, useState, useCallback, useRef } from 'react';
import api from '../api/client';
import type { CalendarMonth, CalendarDay } from '@runway/shared';
import {
  ChevronLeft,
  ChevronRight,
  X,
  Plus,
  Calendar as CalendarIcon,
  Wallet,
  TrendingUp,
  Receipt,
  DollarSign,
  ArrowRight,
  Download,
} from 'lucide-react';
import InfoTip from '../components/InfoTip';
import useTrack from '../hooks/useTrack';

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function fmt(n: number): string {
  return n.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

function formatDateLabel(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
}

function generateICS(data: CalendarMonth, monthLabel: string): string {
  const lines: string[] = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Runway//Financial Calendar//EN',
    `X-WR-CALNAME:Runway - ${monthLabel}`,
  ];

  const datestamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');

  data.days.forEach(day => {
    const dtDate = day.date.replace(/-/g, '');

    if (day.isPayday) {
      lines.push(
        'BEGIN:VEVENT',
        `DTSTART;VALUE=DATE:${dtDate}`,
        `DTSTAMP:${datestamp}`,
        `UID:payday-${day.date}@runway`,
        `SUMMARY:Payday +$${fmt(day.incomeAmount)}`,
        `DESCRIPTION:Projected balance: $${fmt(day.projectedBalance)}`,
        'END:VEVENT',
      );
    }

    day.events.forEach((ev, i) => {
      lines.push(
        'BEGIN:VEVENT',
        `DTSTART;VALUE=DATE:${dtDate}`,
        `DTSTAMP:${datestamp}`,
        `UID:event-${day.date}-${i}@runway`,
        `SUMMARY:${ev.name} -$${fmt(ev.amount)}`,
        `DESCRIPTION:Amount: $${fmt(ev.amount)}\\nProjected balance: $${fmt(day.projectedBalance)}`,
        'END:VEVENT',
      );
    });

    if (day.projectedBalance < 0) {
      lines.push(
        'BEGIN:VEVENT',
        `DTSTART;VALUE=DATE:${dtDate}`,
        `DTSTAMP:${datestamp}`,
        `UID:warning-${day.date}@runway`,
        `SUMMARY:⚠ Negative Balance: -$${fmt(Math.abs(day.projectedBalance))}`,
        `DESCRIPTION:Projected balance drops to $${fmt(day.projectedBalance)} on this day.`,
        'END:VEVENT',
      );
    }
  });

  lines.push('END:VCALENDAR');
  return lines.join('\r\n');
}

function generateCSV(data: CalendarMonth): string {
  const rows: string[] = ['Date,Day,Projected Balance,Income,Bills/Expenses,Status'];

  data.days.forEach(day => {
    const d = new Date(day.date + 'T00:00:00');
    const dayName = d.toLocaleDateString('en-US', { weekday: 'long' });
    const income = day.isPayday ? `+$${fmt(day.incomeAmount)}` : '';
    const events = day.events.map(e => `${e.name} (-$${fmt(e.amount)})`).join('; ');
    const status = day.projectedBalance < 0 ? 'Negative' : day.status === 'yellow' ? 'Warning' : 'OK';

    rows.push(
      `${day.date},${dayName},$${fmt(day.projectedBalance)},${income},"${events}",${status}`
    );
  });

  return rows.join('\n');
}

function downloadFile(content: string, filename: string, mime: string) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export default function Calendar() {
  const track = useTrack('calendar');
  const [data, setData] = useState<CalendarMonth | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentMonth, setCurrentMonth] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  });

  // Side panel state
  const [selectedDay, setSelectedDay] = useState<CalendarDay | null>(null);
  const [panelOpen, setPanelOpen] = useState(false);

  // Add expense form state
  const [showAddForm, setShowAddForm] = useState(false);
  const [newEventName, setNewEventName] = useState('');
  const [newEventAmount, setNewEventAmount] = useState('');
  const [saving, setSaving] = useState(false);

  // Standalone "Add Expense" modal (doesn't require clicking a day first)
  const [showQuickAdd, setShowQuickAdd] = useState(false);
  const [quickDate, setQuickDate] = useState('');
  const [quickName, setQuickName] = useState('');
  const [quickAmount, setQuickAmount] = useState('');
  const [quickSaving, setQuickSaving] = useState(false);

  // Export dropdown state
  const [exportOpen, setExportOpen] = useState(false);
  const exportRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (exportRef.current && !exportRef.current.contains(e.target as Node)) {
        setExportOpen(false);
      }
    }
    if (exportOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [exportOpen]);

  const fetchCalendar = useCallback(() => {
    setLoading(true);
    setError(null);
    api.get(`/runway/calendar?month=${currentMonth}`)
      .then(r => setData(r.data))
      .catch(() => setError('Could not load calendar data'))
      .finally(() => setLoading(false));
  }, [currentMonth]);

  useEffect(() => {
    fetchCalendar();
  }, [fetchCalendar]);

  // When data refreshes, update the selected day if panel is open
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
    closeSidePanel();
  }

  function openSidePanel(day: CalendarDay) {
    setSelectedDay(day);
    setPanelOpen(true);
    setShowAddForm(false);
    setNewEventName('');
    setNewEventAmount('');
  }

  function closeSidePanel() {
    setPanelOpen(false);
    setSelectedDay(null);
    setShowAddForm(false);
  }

  async function handleAddEvent() {
    if (!newEventName.trim() || !newEventAmount.trim() || !selectedDay) return;
    track('calendar', 'add_expense');
    setSaving(true);
    try {
      await api.post('/events', {
        name: newEventName.trim(),
        estimated_amount: parseFloat(newEventAmount),
        expected_date: selectedDay.date,
      });
      setNewEventName('');
      setNewEventAmount('');
      setShowAddForm(false);
      fetchCalendar();
    } catch {
      // Could show an error toast here
    } finally {
      setSaving(false);
    }
  }

  async function handleQuickAdd() {
    if (!quickName.trim() || !quickAmount.trim() || !quickDate) return;
    setQuickSaving(true);
    try {
      await api.post('/events', {
        name: quickName.trim(),
        estimated_amount: parseFloat(quickAmount),
        expected_date: quickDate,
      });
      setQuickName('');
      setQuickAmount('');
      setQuickDate('');
      setShowQuickAdd(false);
      fetchCalendar();
    } catch {
      // Could show an error toast here
    } finally {
      setQuickSaving(false);
    }
  }

  // Limit to 6 months forward from today
  const today = new Date();
  const maxMonth = `${today.getFullYear()}-${String(today.getMonth() + 7).padStart(2, '0')}`;
  const canGoForward = currentMonth < maxMonth;

  const monthLabel = (() => {
    const [y, m] = currentMonth.split('-').map(Number);
    return new Date(y, m - 1, 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  })();

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="flex items-center gap-3 text-slate-400">
          <CalendarIcon className="w-5 h-5 animate-pulse" />
          <span className="text-sm font-medium">Loading calendar...</span>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="text-red-500 text-center py-12 text-sm">{error || 'Something went wrong'}</div>
    );
  }

  const [yr, mn] = currentMonth.split('-').map(Number);
  const firstDayOfWeek = new Date(yr, mn - 1, 1).getDay();

  const balanceColor = (val: number) =>
    val < 0 ? 'text-red-600' : val < 200 ? 'text-amber-600' : 'text-slate-900';

  return (
    <div className="space-y-5">
      {/* ---- Month Header ---- */}
      <div className="flex items-center justify-between bg-white rounded-2xl shadow-sm px-5 py-3">
        <button
          onClick={() => navigateMonth(-1)}
          className="p-2 rounded-xl hover:bg-slate-100 text-slate-500 transition-all duration-200"
          aria-label="Previous month"
        >
          <ChevronLeft className="w-5 h-5" />
        </button>
        <h1 className="text-lg font-semibold text-slate-900 tracking-tight">{monthLabel}</h1>
        <div className="flex items-center gap-1">
          <button
            onClick={() => { setShowQuickAdd(true); setQuickDate(''); }}
            className="p-2 rounded-xl hover:bg-indigo-50 text-indigo-500 transition-all duration-200"
            aria-label="Add upcoming expense"
            title="Add upcoming expense"
          >
            <Plus className="w-5 h-5" />
          </button>
          <div className="relative" ref={exportRef}>
            <button
              onClick={() => setExportOpen(v => !v)}
              className="p-2 rounded-xl hover:bg-slate-100 text-slate-500 transition-all duration-200"
              aria-label="Download calendar"
              title="Download calendar"
            >
              <Download className="w-5 h-5" />
            </button>
            {exportOpen && (
              <div className="absolute right-0 top-full mt-1 z-50 w-48 bg-white rounded-xl shadow-lg border border-slate-200 py-1">
                <button
                  onClick={() => {
                    downloadFile(generateICS(data, monthLabel), `runway-calendar-${currentMonth}.ics`, 'text/calendar');
                    setExportOpen(false);
                  }}
                  className="w-full text-left px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-50 transition-colors flex items-center gap-2"
                >
                  <CalendarIcon className="w-4 h-4 text-slate-400" />
                  Download .ics
                </button>
                <button
                  onClick={() => {
                    downloadFile(generateCSV(data), `runway-calendar-${currentMonth}.csv`, 'text/csv');
                    setExportOpen(false);
                  }}
                  className="w-full text-left px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-50 transition-colors flex items-center gap-2"
                >
                  <Receipt className="w-4 h-4 text-slate-400" />
                  Download .csv
                </button>
              </div>
            )}
          </div>
          <button
            onClick={() => navigateMonth(1)}
            disabled={!canGoForward}
            className={`p-2 rounded-xl transition-all duration-200 ${
              canGoForward ? 'hover:bg-slate-100 text-slate-500' : 'text-slate-200 cursor-not-allowed'
            }`}
            aria-label="Next month"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* ---- Month Summary Stat Cards ---- */}
      <div className="grid grid-cols-3 gap-3">
        {/* Left to spend */}
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-emerald-500 to-emerald-600 p-4 text-white shadow-sm">
          <div className="absolute top-2 right-2">
            <InfoTip text="Your monthly budget minus what you've already spent on everyday things like groceries, dining, and shopping. Bills aren't included because they're already accounted for." />
          </div>
          <p className="text-[11px] font-medium uppercase tracking-wider text-emerald-100">Left to Spend</p>
          <p className="text-xl font-bold mt-1">${fmt(Math.max(0, data.monthlyBudget - data.spentSoFar))}</p>
          <p className="text-[10px] text-emerald-200 mt-0.5">of ${fmt(data.monthlyBudget)}/mo</p>
        </div>

        {/* Spent so far */}
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-slate-600 to-slate-700 p-4 text-white shadow-sm">
          <div className="absolute top-2 right-2">
            <InfoTip text="How much you've spent this month on everyday purchases like groceries, dining out, shopping, etc. This doesn't include your fixed bills like rent or subscriptions." />
          </div>
          <p className="text-[11px] font-medium uppercase tracking-wider text-slate-300">Spent So Far</p>
          <p className="text-xl font-bold mt-1">${fmt(data.spentSoFar)}</p>
          <p className="text-[10px] text-slate-300 mt-0.5">this month</p>
        </div>

        {/* On track or over */}
        <div className={`relative overflow-hidden rounded-2xl p-4 text-white shadow-sm ${
          data.monthStatus === 'red'
            ? 'bg-gradient-to-br from-red-500 to-red-600'
            : data.monthStatus === 'yellow'
            ? 'bg-gradient-to-br from-amber-500 to-amber-600'
            : 'bg-gradient-to-br from-emerald-500 to-emerald-600'
        }`}>
          <div className="absolute top-2 right-2">
            <InfoTip text="Based on your spending pace so far, this is how much you'll likely spend by the end of the month. Green means you're on track, yellow means watch out, red means you're over budget." />
          </div>
          <p className="text-[11px] font-medium uppercase tracking-wider opacity-80">On Pace For</p>
          <p className="text-xl font-bold mt-1">${fmt(data.projectedMonthlySpend)}</p>
          {data.overBudget && (
            <p className="text-[10px] opacity-80 mt-0.5">${fmt(data.projectedMonthlySpend - data.monthlyBudget)} over</p>
          )}
        </div>
      </div>

      {/* ---- Main Content: Calendar + Side Panel ---- */}
      <div className="flex gap-4 relative">
        {/* Calendar Grid */}
        <div className={`transition-all duration-300 ${panelOpen ? 'w-full lg:w-3/5' : 'w-full'}`}>
          <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
            {/* Day-of-week headers */}
            <div className="grid grid-cols-7 border-b border-slate-100">
              {DAY_NAMES.map(d => (
                <div key={d} className="text-center text-[11px] font-semibold text-slate-400 py-2.5 uppercase tracking-wider">
                  {d}
                </div>
              ))}
            </div>

            {/* Day cells */}
            <div className="grid grid-cols-7">
              {/* Leading empty cells */}
              {Array.from({ length: firstDayOfWeek }).map((_, i) => (
                <div key={`empty-${i}`} className="min-h-[76px] sm:min-h-[88px] border-b border-r border-slate-50 bg-slate-50/40" />
              ))}

              {data.days.map((day, idx) => {
                const dayNum = idx + 1;
                const isSelected = selectedDay?.date === day.date;

                const cellBg = day.isPast
                  ? 'bg-slate-50/60'
                  : day.status === 'red'
                  ? 'bg-red-50/50'
                  : day.status === 'yellow'
                  ? 'bg-amber-50/40'
                  : 'bg-white';

                return (
                  <button
                    key={day.date}
                    type="button"
                    onClick={() => openSidePanel(day)}
                    className={`min-h-[76px] sm:min-h-[88px] p-1.5 sm:p-2 border-b border-r border-slate-50 text-left
                      transition-all duration-200 hover:bg-indigo-50/60 hover:shadow-inner cursor-pointer
                      ${cellBg}
                      ${day.isToday ? 'ring-2 ring-inset ring-indigo-500' : ''}
                      ${isSelected ? 'bg-indigo-50 ring-2 ring-inset ring-indigo-400' : ''}
                      ${day.isPast ? 'opacity-50' : ''}
                    `}
                  >
                    {/* Day number */}
                    <div className="flex items-center justify-between mb-0.5">
                      <span className={`text-xs sm:text-sm font-semibold ${
                        day.isToday ? 'bg-indigo-600 text-white w-6 h-6 sm:w-7 sm:h-7 rounded-full flex items-center justify-center' : 'text-slate-700'
                      }`}>
                        {dayNum}
                      </span>
                      {/* Dots */}
                      <div className="flex items-center gap-0.5">
                        {day.isPayday && <span className="w-2 h-2 rounded-full bg-emerald-500" />}
                        {day.events.length > 0 && <span className="w-2 h-2 rounded-full bg-orange-400" />}
                        {day.eventsCost > 0 && <span className="w-2 h-2 rounded-full bg-blue-400" />}
                      </div>
                    </div>

                    {/* Projected balance */}
                    <p className={`text-[11px] sm:text-xs font-semibold ${
                      day.projectedBalance < 0 ? 'text-red-600' :
                      day.status === 'yellow' ? 'text-amber-600' :
                      'text-slate-600'
                    }`}>
                      ${fmt(day.projectedBalance)}
                    </p>

                    {/* Payday indicator */}
                    {day.isPayday && (
                      <p className="text-[9px] sm:text-[10px] text-emerald-600 font-semibold mt-0.5 truncate">
                        +${fmt(day.incomeAmount)}
                      </p>
                    )}
                  </button>
                );
              })}

              {/* Trailing empty cells */}
              {(() => {
                const totalCells = firstDayOfWeek + data.days.length;
                const trailing = totalCells % 7 === 0 ? 0 : 7 - (totalCells % 7);
                return Array.from({ length: trailing }).map((_, i) => (
                  <div key={`trail-${i}`} className="min-h-[76px] sm:min-h-[88px] border-b border-r border-slate-50 bg-slate-50/40" />
                ));
              })()}
            </div>
          </div>
        </div>

        {/* ---- Side Panel (Desktop) ---- */}
        {panelOpen && selectedDay && (
          <div className="hidden lg:block w-2/5 transition-all duration-300">
            <div className="bg-white rounded-2xl shadow-sm p-5 sticky top-4">
              <SidePanelContent
                day={selectedDay}
                onClose={closeSidePanel}
                showAddForm={showAddForm}
                setShowAddForm={setShowAddForm}
                newEventName={newEventName}
                setNewEventName={setNewEventName}
                newEventAmount={newEventAmount}
                setNewEventAmount={setNewEventAmount}
                saving={saving}
                onSave={handleAddEvent}
              />
            </div>
          </div>
        )}
      </div>

      {/* ---- Side Panel (Mobile Bottom Sheet) ---- */}
      {panelOpen && selectedDay && (
        <div className="lg:hidden fixed inset-0 z-50 flex items-end">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/40 transition-opacity duration-300"
            onClick={closeSidePanel}
          />
          {/* Sheet */}
          <div className="relative w-full bg-white rounded-t-2xl shadow-lg max-h-[80vh] overflow-y-auto p-5 animate-slide-up">
            <div className="w-10 h-1 bg-slate-200 rounded-full mx-auto mb-4" />
            <SidePanelContent
              day={selectedDay}
              onClose={closeSidePanel}
              showAddForm={showAddForm}
              setShowAddForm={setShowAddForm}
              newEventName={newEventName}
              setNewEventName={setNewEventName}
              newEventAmount={newEventAmount}
              setNewEventAmount={setNewEventAmount}
              saving={saving}
              onSave={handleAddEvent}
            />
          </div>
        </div>
      )}

      {/* ---- This Month at a Glance ---- */}
      <div className="bg-white rounded-2xl shadow-sm p-5">
        <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wider mb-4">
          This Month at a Glance
        </h2>
        <div className="flex items-center justify-between gap-2">
          {/* Start */}
          <div className="text-center flex-1">
            <p className="text-[11px] text-slate-400 font-medium">Start</p>
            <p className="text-lg font-bold text-slate-900">${fmt(data.startingBalance)}</p>
          </div>

          <ArrowRight className="w-4 h-4 text-slate-300 shrink-0" />

          {/* Lowest */}
          <div className={`text-center flex-1 rounded-xl py-2 px-3 ${
            data.lowestBalance < 0
              ? 'bg-red-50 ring-1 ring-red-200'
              : data.lowestBalance < data.startingBalance * 0.2
              ? 'bg-amber-50 ring-1 ring-amber-200'
              : 'bg-slate-50'
          }`}>
            <p className="text-[11px] text-slate-400 font-medium">Lowest</p>
            <p className={`text-lg font-bold ${
              data.lowestBalance < 0 ? 'text-red-600' :
              data.lowestBalance < data.startingBalance * 0.2 ? 'text-amber-600' :
              'text-slate-900'
            }`}>
              ${fmt(data.lowestBalance)}
            </p>
            <p className="text-[10px] text-slate-400">
              {new Date(data.lowestBalanceDate + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
            </p>
          </div>

          <ArrowRight className="w-4 h-4 text-slate-300 shrink-0" />

          {/* End */}
          <div className="text-center flex-1">
            <p className="text-[11px] text-slate-400 font-medium">End</p>
            <p className={`text-lg font-bold ${data.endingBalance < 0 ? 'text-red-600' : 'text-slate-900'}`}>
              ${fmt(data.endingBalance)}
            </p>
          </div>
        </div>
      </div>

      {/* ---- Quick Add Expense Modal ---- */}
      {showQuickAdd && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40" onClick={() => setShowQuickAdd(false)} />
          <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-md p-6 space-y-4 animate-fade-in">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-slate-900">Add Upcoming Expense</h2>
              <button onClick={() => setShowQuickAdd(false)} className="p-1.5 rounded-xl hover:bg-slate-100 text-slate-400">
                <X className="w-5 h-5" />
              </button>
            </div>
            <p className="text-sm text-slate-500 -mt-2">Add a bill, purchase, or expense you're expecting. It'll show up on your calendar so your balance projections stay accurate.</p>
            <div className="space-y-3">
              <div>
                <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-400 mb-1">What's the expense?</label>
                <input
                  type="text"
                  placeholder="e.g. Car Insurance, Dentist Visit"
                  value={quickName}
                  onChange={e => setQuickName(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent focus:bg-white transition"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-400 mb-1">Amount</label>
                  <div className="relative">
                    <span className="absolute left-3 top-2.5 text-sm text-slate-400">$</span>
                    <input
                      type="number"
                      min="0"
                      step="any"
                      placeholder="0"
                      value={quickAmount}
                      onChange={e => setQuickAmount(e.target.value)}
                      className="w-full rounded-xl border border-slate-200 bg-slate-50 pl-7 pr-3 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent focus:bg-white transition"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-400 mb-1">Date</label>
                  <input
                    type="date"
                    value={quickDate}
                    onChange={e => setQuickDate(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent focus:bg-white transition"
                  />
                </div>
              </div>
            </div>
            <div className="flex gap-2 justify-end pt-2">
              <button
                onClick={() => setShowQuickAdd(false)}
                className="px-4 py-2.5 rounded-xl text-sm text-slate-600 hover:bg-slate-100 transition"
              >
                Cancel
              </button>
              <button
                onClick={handleQuickAdd}
                disabled={quickSaving || !quickName.trim() || !quickAmount.trim() || !quickDate}
                className="px-5 py-2.5 rounded-xl bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition shadow-lg shadow-indigo-500/25"
              >
                {quickSaving ? 'Adding...' : 'Add Expense'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ---- Side Panel Content Component ---- */

interface SidePanelContentProps {
  day: CalendarDay;
  onClose: () => void;
  showAddForm: boolean;
  setShowAddForm: (v: boolean) => void;
  newEventName: string;
  setNewEventName: (v: string) => void;
  newEventAmount: string;
  setNewEventAmount: (v: string) => void;
  saving: boolean;
  onSave: () => void;
}

function SidePanelContent({
  day,
  onClose,
  showAddForm,
  setShowAddForm,
  newEventName,
  setNewEventName,
  newEventAmount,
  setNewEventAmount,
  saving,
  onSave,
}: SidePanelContentProps) {
  const balanceColor =
    day.projectedBalance < 0 ? 'text-red-600' :
    day.projectedBalance < 200 ? 'text-amber-600' :
    'text-emerald-600';

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">{formatDateLabel(day.date)}</h2>
          {day.isToday && (
            <span className="text-[11px] font-medium text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-full">
              Today
            </span>
          )}
        </div>
        <button
          onClick={onClose}
          className="p-1.5 rounded-xl hover:bg-slate-100 text-slate-400 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* What you'll have */}
      <div className="bg-slate-50 rounded-xl p-4">
        <div className="flex items-center justify-between">
          <p className="text-[11px] text-slate-400 font-medium uppercase tracking-wider">You'll Have</p>
          <InfoTip text="Your estimated bank balance on this day, based on your current balance, upcoming paychecks, and bills." />
        </div>
        <p className={`text-2xl font-bold mt-1 ${balanceColor}`}>
          ${fmt(day.projectedBalance)}
        </p>
      </div>

      {/* Income section */}
      {day.isPayday && (
        <div className="bg-emerald-50 rounded-xl p-4 border border-emerald-100">
          <div className="flex items-center gap-2 mb-1">
            <DollarSign className="w-4 h-4 text-emerald-600" />
            <p className="text-sm font-semibold text-emerald-800">Income</p>
          </div>
          <p className="text-lg font-bold text-emerald-700">+${fmt(day.incomeAmount)}</p>
        </div>
      )}

      {/* Bills & Expenses */}
      <div>
        <p className="text-sm font-semibold text-slate-700 mb-2">Bills & Expenses</p>
        {day.events.length > 0 ? (
          <div className="space-y-2">
            {day.events.map((ev, i) => (
              <div key={i} className="flex items-center justify-between bg-slate-50 rounded-xl px-4 py-3">
                <span className="text-sm text-slate-700 font-medium">{ev.name}</span>
                <span className="text-sm font-semibold text-red-600">-${fmt(ev.amount)}</span>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-slate-400">Nothing scheduled for this day.</p>
        )}
      </div>

      {/* Add Expense */}
      {!showAddForm ? (
        <button
          onClick={() => setShowAddForm(true)}
          className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl border-2 border-dashed border-slate-200 text-slate-500 hover:border-indigo-300 hover:text-indigo-600 hover:bg-indigo-50/50 transition-all duration-200 text-sm font-medium"
        >
          <Plus className="w-4 h-4" />
          Add Expense
        </button>
      ) : (
        <div className="space-y-3 bg-slate-50 rounded-xl p-4">
          <p className="text-sm font-semibold text-slate-700">New Upcoming Expense</p>
          <input
            type="text"
            placeholder="e.g. Car Insurance, Doctor Visit"
            value={newEventName}
            onChange={e => setNewEventName(e.target.value)}
            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
          />
          <input
            type="number"
            placeholder="Amount"
            value={newEventAmount}
            onChange={e => setNewEventAmount(e.target.value)}
            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
          />
          <div className="flex gap-2">
            <button
              onClick={onSave}
              disabled={saving || !newEventName.trim() || !newEventAmount.trim()}
              className="flex-1 py-2 rounded-lg bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
            >
              {saving ? 'Saving...' : 'Save'}
            </button>
            <button
              onClick={() => setShowAddForm(false)}
              className="px-4 py-2 rounded-lg bg-slate-200 text-slate-600 text-sm font-medium hover:bg-slate-300 transition-all"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
