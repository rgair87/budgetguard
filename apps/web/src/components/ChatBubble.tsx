import { useEffect, useRef, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { MessageCircle, X, Send, ExternalLink, Sparkles } from 'lucide-react';
import api from '../api/client';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
}

const SUGGESTIONS = [
  'Can I afford a $500 purchase?',
  "How's my spending this month?",
  "When's my next payday?",
];

export default function ChatBubble() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [hasAnimated, setHasAnimated] = useState(false);
  const [viewportH, setViewportH] = useState<number | null>(null);
  const [viewportOffset, setViewportOffset] = useState(0);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  // Pulse animation on first load
  useEffect(() => {
    const t = setTimeout(() => setHasAnimated(true), 4000);
    return () => clearTimeout(t);
  }, []);

  // Track visual viewport height (shrinks when keyboard opens on mobile)
  useEffect(() => {
    if (!open) return;
    const vv = window.visualViewport;
    if (!vv) return;

    function onResize() {
      setViewportH(vv!.height);
      setViewportOffset(vv!.offsetTop);
    }
    onResize();
    vv.addEventListener('resize', onResize);
    vv.addEventListener('scroll', onResize);
    return () => {
      vv.removeEventListener('resize', onResize);
      vv.removeEventListener('scroll', onResize);
    };
  }, [open]);

  // Scroll to bottom on new messages
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  // Focus input when panel opens (only on desktop to avoid keyboard pop on mobile)
  useEffect(() => {
    if (open && window.innerWidth >= 768) {
      inputRef.current?.focus();
    }
  }, [open]);

  // Close on escape
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false);
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  const handleClose = useCallback(() => {
    setOpen(false);
    // Blur input to dismiss keyboard
    inputRef.current?.blur();
  }, []);

  async function send(text?: string) {
    const msg = text || input.trim();
    if (!msg || loading) return;
    setInput('');

    const userMsg: Message = { id: Date.now().toString(), role: 'user', content: msg };
    setMessages(prev => [...prev, userMsg]);
    setLoading(true);

    try {
      const { data } = await api.post('/chat', { message: msg });
      const assistantMsg: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: data.reply,
      };
      setMessages(prev => [...prev, assistantMsg]);
    } catch {
      const errMsg: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: 'Sorry, I had trouble processing that. Please try again.',
      };
      setMessages(prev => [...prev, errMsg]);
    } finally {
      setLoading(false);
    }
  }

  // On mobile, fill the visual viewport (shrinks when keyboard opens).
  // Use top positioning instead of bottom so the panel stays anchored to the
  // visible area and the keyboard doesn't cover the input.
  const isMobile = typeof window !== 'undefined' && window.innerWidth < 768;
  const keyboardOpen = isMobile && viewportH && viewportH < window.innerHeight * 0.8;
  const panelHeight = isMobile
    ? viewportH
      ? `${viewportH}px`
      : 'calc(100dvh - 1.5rem)'
    : '500px';

  return (
    <>
      {/* Backdrop on mobile when open */}
      {open && (
        <div
          className="md:hidden fixed inset-0 bg-black/30 backdrop-blur-sm z-40"
          onClick={handleClose}
        />
      )}

      {/* Chat panel */}
      <div
        ref={panelRef}
        className={`fixed z-50 transition-all duration-300 ease-out ${
          open
            ? 'right-0 md:right-6 w-full md:w-96 opacity-100 translate-y-0 scale-100'
            : 'bottom-6 right-4 md:right-6 w-0 opacity-0 translate-y-4 scale-95 pointer-events-none'
        }`}
        style={open ? {
          height: panelHeight,
          // On mobile with keyboard: position from top of visual viewport
          // On mobile without keyboard: anchor to bottom
          // On desktop: anchor to bottom
          ...(keyboardOpen
            ? { top: `${viewportOffset}px`, bottom: 'auto' }
            : { bottom: isMobile ? 0 : 24 }),
        } : { height: 0 }}
      >
        {open && (
          <div className="flex flex-col w-full h-full bg-white md:rounded-2xl rounded-t-2xl shadow-2xl border border-slate-200/60 overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 bg-gradient-to-r from-indigo-600 to-violet-600 shrink-0">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-indigo-200" />
                <span className="text-sm font-semibold text-white">Ask Spenditure</span>
              </div>
              <div className="flex items-center gap-1">
                <Link
                  to="/chat"
                  onClick={handleClose}
                  className="flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-medium text-indigo-100 hover:bg-white/15 transition-colors"
                >
                  Open full chat
                  <ExternalLink className="w-3 h-3" />
                </Link>
                <button
                  onClick={handleClose}
                  className="p-1.5 rounded-md hover:bg-white/15 transition-colors"
                  aria-label="Close chat"
                >
                  <X className="w-4 h-4 text-white" />
                </button>
              </div>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3 overscroll-contain">
              {messages.length === 0 && !loading && (
                <div className="flex flex-col items-center justify-center h-full text-center">
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-indigo-100 to-violet-100 flex items-center justify-center mb-3">
                    <MessageCircle className="w-5 h-5 text-indigo-500" />
                  </div>
                  <p className="text-sm font-medium text-slate-700 mb-1">How can I help?</p>
                  <p className="text-xs text-slate-400 mb-4">Ask anything about your finances</p>
                  <div className="flex flex-col gap-2 w-full">
                    {SUGGESTIONS.map(s => (
                      <button
                        key={s}
                        onClick={() => send(s)}
                        className="w-full text-left px-3 py-2 bg-slate-50 hover:bg-indigo-50 border border-slate-200 hover:border-indigo-200 rounded-xl text-xs text-slate-600 hover:text-indigo-700 transition-all duration-150"
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {messages.map(msg => (
                <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div
                    className={`max-w-[80%] rounded-xl px-3 py-2 ${
                      msg.role === 'user'
                        ? 'bg-indigo-600 text-white'
                        : 'bg-slate-100 text-slate-800'
                    }`}
                  >
                    <p className="text-[13px] leading-relaxed whitespace-pre-wrap">{msg.content}</p>
                  </div>
                </div>
              ))}

              {loading && (
                <div className="flex justify-start">
                  <div className="bg-slate-100 rounded-xl px-4 py-2.5">
                    <div className="flex items-center gap-1">
                      <span className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                      <span className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                      <span className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                    </div>
                  </div>
                </div>
              )}

              <div ref={bottomRef} />
            </div>

            {/* Input - stays above keyboard */}
            <form
              onSubmit={e => { e.preventDefault(); send(); }}
              className="shrink-0 flex items-center gap-2 px-3 py-3 border-t border-slate-100 bg-white safe-bottom"
              style={{ paddingBottom: `max(0.75rem, env(safe-area-inset-bottom))` }}
            >
              <input
                ref={inputRef}
                value={input}
                onChange={e => setInput(e.target.value)}
                placeholder="Ask about your finances..."
                disabled={loading}
                enterKeyHint="send"
                onFocus={() => setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 300)}
                className="flex-1 text-[16px] md:text-sm bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent disabled:opacity-50 placeholder:text-slate-400"
              />
              <button
                type="submit"
                disabled={loading || !input.trim()}
                className="p-2.5 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 text-white hover:from-indigo-700 hover:to-violet-700 disabled:opacity-40 transition-all duration-150 shrink-0"
                aria-label="Send message"
              >
                <Send className="w-4 h-4" />
              </button>
            </form>
          </div>
        )}
      </div>

      {/* Floating bubble button */}
      <button
        onClick={() => setOpen(o => !o)}
        className={`fixed z-50 bottom-20 md:bottom-6 right-4 md:right-6 w-14 h-14 rounded-full bg-gradient-to-br from-indigo-500 to-violet-600 text-white shadow-lg hover:shadow-xl hover:scale-105 transition-all duration-300 flex items-center justify-center ${
          open ? 'scale-0 opacity-0 pointer-events-none' : 'scale-100 opacity-100'
        } ${!hasAnimated ? 'animate-pulse' : ''}`}
        aria-label="Open chat"
      >
        <MessageCircle className="w-6 h-6" />
      </button>
    </>
  );
}
