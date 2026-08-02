import React, { useEffect, useRef, useState } from 'react';
import { X, Send, MessageSquare } from 'lucide-react';

export default function ChatPanel({ open, onClose, messages, onSend, mySocketId }) {
  const [text, setText] = useState('');
  const listRef = useRef(null);

  useEffect(() => {
    if (listRef.current) listRef.current.scrollTop = listRef.current.scrollHeight;
  }, [messages, open]);

  if (!open) return null;

  const submit = (e) => {
    e.preventDefault();
    if (!text.trim()) return;
    onSend(text);
    setText('');
  };

  return (
    <div className="pointer-events-auto flex h-[60vh] max-h-[70vh] w-80 max-w-[calc(100vw-1.5rem)] flex-col rounded-xl border border-gray-200 bg-white shadow-xl">
      <div className="flex items-center justify-between border-b border-gray-100 px-4 py-3">
        <div className="flex items-center gap-2 text-sm font-semibold text-gray-800">
          <MessageSquare size={16} className="text-gray-900" /> Chat
        </div>
        <button type="button" onClick={onClose} className="rounded-lg p-1 text-gray-500 hover:bg-gray-100">
          <X size={16} />
        </button>
      </div>

      <div ref={listRef} className="flex-1 space-y-3 overflow-y-auto px-3 py-3">
        {messages.length === 0 ? (
          <p className="mt-6 text-center text-xs text-gray-400">No messages yet. Say hello!</p>
        ) : (
          messages.map((m) => {
            const mine = m.socketId === mySocketId;
            return (
              <div key={m.id} className={`flex flex-col ${mine ? 'items-end' : 'items-start'}`}>
                {!mine && (
                  <span className="mb-0.5 text-[11px] font-medium" style={{ color: m.color }}>
                    {m.username}
                  </span>
                )}
                <div
                  className={`max-w-[85%] wrap-break-word rounded-2xl px-3 py-1.5 text-sm ${
                    mine ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-800'
                  }`}
                >
                  {m.text}
                </div>
              </div>
            );
          })
        )}
      </div>

      <form onSubmit={submit} className="flex items-center gap-2 border-t border-gray-100 p-2">
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Type a message…"
          className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-gray-900"
        />
        <button
          type="submit"
          className="flex h-9 w-9 items-center justify-center rounded-lg bg-gray-900 text-white hover:bg-black"
        >
          <Send size={16} />
        </button>
      </form>
    </div>
  );
}
