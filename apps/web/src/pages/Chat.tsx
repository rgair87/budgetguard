import { useEffect, useRef, useState } from 'react';
import { MessageCircle, Send, Sparkles } from 'lucide-react';
import api from '../api/client';
import useTrack from '../hooks/useTrack';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  created_at: string;
}

interface DailyUsage {
  used: number;
  limit: number;
  remaining: number;
}

const SUGGESTED_PROMPTS = [
  'What can I cut?',
  'Am I on track this month?',
  "When's my next payday?",
  'How much can I spend today?',
];

export default function Chat() {
  const track = useTrack('chat');
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [initialLoad, setInitialLoad] = useState(true);
  const [usage, setUsage] = useState<DailyUsage | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    api.get('/chat/history')
      .then(r => {
        setMessages(r.data.messages || r.data);
        if (r.data.dailyUsage) setUsage(r.data.dailyUsage);
      })
      .finally(() => setInitialLoad(false));
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const atLimit = usage ? usage.remaining <= 0 : false;

  async function send(text?: string) {
    const msg = text || input.trim();
    if (!msg || loading || atLimit) return;
    track('chat', 'send_message');
    setInput('');

    const userMsg: Message = { id: Date.now().toString(), role: 'user', content: msg, created_at: new Date().toISOString() };
    setMessages(prev => [...prev, userMsg]);
    setLoading(true);

    try {
      const { data } = await api.post('/chat', { message: msg });
      if (data.dailyUsage) setUsage(data.dailyUsage);
      const assistantMsg: Message = { id: (Date.now() + 1).toString(), role: 'assistant', content: data.reply, created_at: new Date().toISOString() };
      setMessages(prev => [...prev, assistantMsg]);
    } catch (err: any) {
      const errData = err.response?.data;
      if (errData?.error === 'rate_limit') {
        if (errData.dailyUsage) setUsage(errData.dailyUsage);
        const errMsg: Message = { id: (Date.now() + 1).toString(), role: 'assistant', content: errData.message, created_at: new Date().toISOString() };
        setMessages(prev => [...prev, errMsg]);
      } else {
        const errMsg: Message = { id: (Date.now() + 1).toString(), role: 'assistant', content: 'Sorry, I had trouble processing that. Please try again.', created_at: new Date().toISOString() };
        setMessages(prev => [...prev, errMsg]);
      }
    } finally {
      setLoading(false);
    }
  }

  async function clearHistory() {
    await api.delete('/chat/history');
    setMessages([]);
  }

  if (initialLoad) return <div className="text-slate-400 text-center py-12">Loading...</div>;

  return (
    <div className="flex flex-col h-[calc(100vh-8rem)]">
      {/* Gradient header bar */}
      <div className="bg-gradient-to-r from-indigo-600 to-violet-600 rounded-2xl shadow-sm px-5 py-4 mb-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-white/20 flex items-center justify-center">
            <MessageCircle className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-lg font-semibold text-white">Ask Runway</h1>
            <p className="text-xs text-white/70">Ask anything about your finances. I use your real data.</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {usage && (
            <span className={`text-xs px-2 py-1 rounded-lg ${usage.remaining <= 3 ? 'bg-amber-400/20 text-amber-100' : 'bg-white/15 text-white/80'}`}>
              {usage.remaining}/{usage.limit} left today
            </span>
          )}
          {messages.length > 0 && (
            <button onClick={clearHistory} className="text-xs text-white/60 hover:text-white/90 transition-colors">Clear chat</button>
          )}
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto space-y-4 pb-4 px-1">
        {messages.length === 0 && (
          <div className="text-center py-16">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-indigo-100 to-violet-100 flex items-center justify-center mx-auto mb-4">
              <Sparkles className="w-7 h-7 text-indigo-500" />
            </div>
            <p className="text-slate-500 mb-1 text-sm font-medium">How can I help today?</p>
            <p className="text-slate-400 text-xs mb-6">Try one of these to get started</p>
            <div className="flex flex-wrap justify-center gap-2 max-w-md mx-auto">
              {SUGGESTED_PROMPTS.map(prompt => (
                <button
                  key={prompt}
                  onClick={() => send(prompt)}
                  disabled={atLimit}
                  className="px-4 py-2.5 bg-white border border-slate-200/60 rounded-2xl text-sm text-slate-600 hover:border-indigo-300 hover:text-indigo-600 hover:shadow-sm transition-all disabled:opacity-50 shadow-sm"
                >
                  {prompt}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map(msg => (
          <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[75%] rounded-2xl px-4 py-3 ${
              msg.role === 'user'
                ? 'bg-gradient-to-br from-indigo-600 to-violet-600 text-white shadow-sm'
                : 'bg-white border border-slate-200/60 text-slate-900 shadow-sm'
            }`}>
              <p className="text-sm whitespace-pre-wrap leading-relaxed">{msg.content}</p>
            </div>
          </div>
        ))}

        {loading && (
          <div className="flex justify-start">
            <div className="bg-white border border-slate-200/60 rounded-2xl px-5 py-3.5 shadow-sm">
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-indigo-400 animate-bounce" style={{ animationDelay: '0ms' }} />
                <span className="w-2 h-2 rounded-full bg-indigo-400 animate-bounce" style={{ animationDelay: '150ms' }} />
                <span className="w-2 h-2 rounded-full bg-indigo-400 animate-bounce" style={{ animationDelay: '300ms' }} />
              </div>
            </div>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="pt-4">
        {atLimit ? (
          <div className="text-center py-3 bg-amber-50 rounded-2xl border border-amber-200/60">
            <p className="text-sm text-amber-600">You've used all {usage?.limit} messages for today. Resets at midnight.</p>
          </div>
        ) : (
          <form onSubmit={e => { e.preventDefault(); send(); }} className="flex gap-2 items-center">
            <input
              value={input}
              onChange={e => setInput(e.target.value)}
              placeholder="Ask about your finances..."
              disabled={loading}
              className="flex-1 border border-slate-200/60 bg-white rounded-2xl px-5 py-3 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/40 focus:border-indigo-300 disabled:opacity-50 transition-all placeholder:text-slate-400"
            />
            <button
              type="submit"
              disabled={loading || !input.trim()}
              className="bg-gradient-to-r from-indigo-600 to-violet-600 text-white p-3 rounded-2xl shadow-sm hover:from-indigo-700 hover:to-violet-700 disabled:opacity-40 transition-all flex items-center justify-center"
            >
              <Send className="w-4 h-4" />
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
