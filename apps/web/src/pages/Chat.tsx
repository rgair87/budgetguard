import { useEffect, useRef, useState } from 'react';
import api from '../api/client';

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
  'Can I afford a $400 car repair this week?',
  'What happens if I stop eating out this month?',
  'When will I be debt free?',
  'Am I on track for vacation?',
  'How much can I safely spend this weekend?',
  'What should I prioritize paying off?',
];

export default function Chat() {
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

  if (initialLoad) return <div className="text-gray-500 text-center py-12">Loading...</div>;

  return (
    <div className="flex flex-col h-[calc(100vh-8rem)]">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Ask Runway</h1>
          <p className="text-sm text-gray-500">Ask anything about your finances. I use your real data.</p>
        </div>
        <div className="flex items-center gap-3">
          {usage && (
            <span className={`text-xs ${usage.remaining <= 3 ? 'text-amber-600' : 'text-gray-400'}`}>
              {usage.remaining}/{usage.limit} left today
            </span>
          )}
          {messages.length > 0 && (
            <button onClick={clearHistory} className="text-sm text-gray-400 hover:text-gray-600">Clear chat</button>
          )}
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto space-y-4 pb-4">
        {messages.length === 0 && (
          <div className="text-center py-12">
            <p className="text-gray-400 mb-6">Try one of these questions:</p>
            <div className="flex flex-wrap justify-center gap-2">
              {SUGGESTED_PROMPTS.map(prompt => (
                <button
                  key={prompt}
                  onClick={() => send(prompt)}
                  disabled={atLimit}
                  className="px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm text-gray-700 hover:border-indigo-300 hover:text-indigo-600 transition-colors disabled:opacity-50"
                >
                  {prompt}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map(msg => (
          <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[75%] rounded-xl px-4 py-3 ${
              msg.role === 'user'
                ? 'bg-indigo-600 text-white'
                : 'bg-white border border-gray-200 text-gray-900'
            }`}>
              <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
            </div>
          </div>
        ))}

        {loading && (
          <div className="flex justify-start">
            <div className="bg-white border border-gray-200 rounded-xl px-4 py-3">
              <p className="text-sm text-gray-400">Thinking...</p>
            </div>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="border-t border-gray-200 pt-4">
        {atLimit ? (
          <div className="text-center py-2">
            <p className="text-sm text-amber-600">You've used all {usage?.limit} messages for today. Resets at midnight.</p>
          </div>
        ) : (
          <form onSubmit={e => { e.preventDefault(); send(); }} className="flex gap-2">
            <input
              value={input}
              onChange={e => setInput(e.target.value)}
              placeholder="Ask about your finances..."
              disabled={loading}
              className="flex-1 border border-gray-300 rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent disabled:opacity-50"
            />
            <button
              type="submit"
              disabled={loading || !input.trim()}
              className="bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-50"
            >
              Send
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
