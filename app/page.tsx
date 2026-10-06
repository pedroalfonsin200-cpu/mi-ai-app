"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Send, Sparkles, Loader2, Plus, MessageSquare, LogIn, LogOut, Trash2, Menu, X } from "lucide-react";
import { createClient } from "@/lib/supabase-client";
import type { User } from "@supabase/supabase-js";

type Message = {
  role: "user" | "assistant";
  content: string;
  image?: string;
};

type Session = {
  id: string;
  title: string;
  updated_at: string;
};

export default function Home() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const router = useRouter();
  const supabase = createClient();

  const loadSessions = useCallback(async () => {
    const res = await fetch("/api/sessions");
    const data = await res.json();
    setSessions(data.sessions || []);
  }, []);

  // Auth check
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUser(data.user));
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user || null);
      if (session?.user) loadSessions();
    });
    return () => listener.subscription.unsubscribe();
  }, [supabase.auth, loadSessions]);

  useEffect(() => {
    if (user) loadSessions();
  }, [user, loadSessions]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  async function loadSession(id: string) {
    const res = await fetch(`/api/sessions/${id}`);
    const data = await res.json();
    setMessages(data.messages || []);
    setCurrentSessionId(id);
    setSidebarOpen(false);
  }

  async function createSession(title: string): Promise<string | null> {
    const res = await fetch("/api/sessions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title }),
    });
    const data = await res.json();
    if (data.session) {
      loadSessions();
      return data.session.id;
    }
    return null;
  }

  async function deleteSession(id: string, e: React.MouseEvent) {
    e.stopPropagation();
    if (!confirm("¿Borrar este chat?")) return;
    await fetch(`/api/sessions/${id}`, { method: "DELETE" });
    if (currentSessionId === id) {
      setMessages([]);
      setCurrentSessionId(null);
    }
    loadSessions();
  }

  async function handleSend() {
    if (!input.trim() || loading) return;

    const userMsg: Message = { role: "user", content: input };
    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    const sentInput = input;
    setInput("");
    setLoading(true);

    let sessionId = currentSessionId;
    if (user && !sessionId) {
      sessionId = await createSession(sentInput.slice(0, 50));
      setCurrentSessionId(sessionId);
    }

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: newMessages.map((m) => ({ role: m.role, content: m.content })),
          sessionId,
        }),
      });
      const data = await res.json();
      setMessages([...newMessages, {
        role: "assistant",
        content: data.content,
        image: data.image,
      }]);
      if (user) loadSessions();
    } catch {
      setMessages([...newMessages, {
        role: "assistant",
        content: "Perdón, hubo un error. Intenta de nuevo.",
      }]);
    } finally {
      setLoading(false);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  function newChat() {
    setMessages([]);
    setCurrentSessionId(null);
    setInput("");
    inputRef.current?.focus();
    setSidebarOpen(false);
  }

  async function signOut() {
    await supabase.auth.signOut();
    setMessages([]);
    setCurrentSessionId(null);
    router.refresh();
  }

  const hasMessages = messages.length > 0;

  return (
    <div className="flex h-screen bg-black text-white overflow-hidden">
      {/* Fondo cósmico */}
      <div className="fixed inset-0 pointer-events-none z-0">
        <div className="absolute inset-0 bg-black"></div>
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(139,92,246,0.15),transparent_50%)]"></div>
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_bottom_right,rgba(59,130,246,0.1),transparent_60%)]"></div>
        <div className="stars absolute inset-0"></div>
      </div>

      {/* Sidebar */}
      <aside className={`${sidebarOpen ? "translate-x-0" : "-translate-x-full"} md:translate-x-0 fixed md:relative inset-y-0 left-0 w-72 bg-gray-950/80 backdrop-blur-xl border-r border-gray-900 z-30 transition-transform flex flex-col`}>
        <div className="p-4 border-b border-gray-900">
          <button
            onClick={newChat}
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-500 hover:to-blue-500 transition font-medium text-sm shadow-lg shadow-purple-500/20"
          >
            <Plus className="w-4 h-4" />
            Nuevo chat
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-2">
          {user ? (
            sessions.length > 0 ? (
              <div className="space-y-1">
                {sessions.map((s) => (
                  <button
                    key={s.id}
                    onClick={() => loadSession(s.id)}
                    className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-left transition group ${
                      currentSessionId === s.id ? "bg-gray-900" : "hover:bg-gray-900/50"
                    }`}
                  >
                    <MessageSquare className="w-4 h-4 text-gray-500 flex-shrink-0" />
                    <span className="truncate flex-1">{s.title}</span>
                    <button
                      onClick={(e) => deleteSession(s.id, e)}
                      className="opacity-0 group-hover:opacity-100 transition p-1 hover:bg-red-500/20 rounded"
                    >
                      <Trash2 className="w-3 h-3 text-red-400" />
                    </button>
                  </button>
                ))}
              </div>
            ) : (
              <p className="text-center text-sm text-gray-600 mt-8 px-4">
                Tus conversaciones aparecerán aquí
              </p>
            )
          ) : (
            <div className="text-center mt-8 px-4">
              <p className="text-sm text-gray-500 mb-4">
                Inicia sesión para guardar tus chats
              </p>
            </div>
          )}
        </div>

        <div className="p-3 border-t border-gray-900">
          {user ? (
            <div className="flex items-center gap-3 px-2 py-2">
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-500 to-blue-500 flex items-center justify-center text-sm font-medium">
                {user.email?.[0].toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{user.email}</p>
                <p className="text-xs text-gray-500">Plan Free</p>
              </div>
              <button
                onClick={signOut}
                className="p-2 rounded-lg hover:bg-gray-900 transition"
                title="Cerrar sesión"
              >
                <LogOut className="w-4 h-4 text-gray-400" />
              </button>
            </div>
          ) : (
            <button
              onClick={() => router.push("/auth/login")}
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-gray-900 hover:bg-gray-800 border border-gray-800 transition text-sm"
            >
              <LogIn className="w-4 h-4" />
              Iniciar sesión
            </button>
          )}
        </div>
      </aside>

      {/* Overlay móvil */}
      {sidebarOpen && (
        <div
          onClick={() => setSidebarOpen(false)}
          className="md:hidden fixed inset-0 bg-black/60 z-20"
        />
      )}

      {/* Main */}
      <main className="flex-1 flex flex-col relative z-10 min-w-0">
        {/* Header */}
        <header className="flex items-center justify-between px-4 py-3 border-b border-gray-900/50 backdrop-blur-xl">
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="md:hidden p-2 rounded-lg hover:bg-gray-900 transition"
          >
            {sidebarOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-purple-500 to-blue-500 flex items-center justify-center">
              <Sparkles className="w-4 h-4" />
            </div>
            <h1 className="text-sm font-semibold">Ramoncito</h1>
          </div>
          <div className="w-9 md:hidden"></div>
        </header>

        {/* Content */}
        {!hasMessages ? (
          <div className="flex-1 flex flex-col items-center justify-center px-6 -mt-16">
            <div className="w-24 h-24 rounded-3xl bg-gradient-to-br from-purple-500 via-blue-500 to-purple-600 flex items-center justify-center mb-8 shadow-[0_0_80px_rgba(139,92,246,0.4)] relative">
              <Sparkles className="w-12 h-12 text-white" />
              <div className="absolute inset-0 rounded-3xl bg-gradient-to-br from-purple-500 to-blue-500 blur-2xl opacity-50 -z-10"></div>
            </div>
            <h1 className="text-5xl md:text-6xl font-bold mb-3 bg-gradient-to-b from-white via-white to-gray-500 bg-clip-text text-transparent tracking-tight">
              Ramoncito
            </h1>
            <p className="text-gray-500 text-lg mb-12 text-center max-w-md">
              Pregúntame lo que quieras — crea imágenes, busca en la web, razona cualquier problema.
            </p>

            <div className="w-full max-w-2xl">
              <InputBar
                input={input}
                setInput={setInput}
                onSend={handleSend}
                onKeyDown={handleKeyDown}
                loading={loading}
                inputRef={inputRef}
                large
              />
              <div className="grid grid-cols-2 gap-2 mt-4">
                <SuggestionChip text="Explica la teoría cuántica" onClick={setInput} />
                <SuggestionChip text="Crea una imagen cósmica" onClick={setInput} />
                <SuggestionChip text="Receta de pasta rápida" onClick={setInput} />
                <SuggestionChip text="Noticias de hoy" onClick={setInput} />
              </div>
            </div>
          </div>
        ) : (
          <>
            <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-6">
              <div className="max-w-3xl mx-auto space-y-6">
                {messages.map((msg, i) => (
                  <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                    <div className={`max-w-[85%] rounded-2xl px-4 py-3 ${
                      msg.role === "user"
                        ? "bg-gradient-to-br from-purple-600 to-blue-600 text-white shadow-lg shadow-purple-500/20"
                        : "bg-gray-900/80 backdrop-blur text-gray-100 border border-gray-800"
                    }`}>
                      <p className="whitespace-pre-wrap leading-relaxed">{msg.content}</p>
                      {msg.image && <GeneratedImage src={msg.image} />}
                    </div>
                  </div>
                ))}

                {loading && (
                  <div className="flex justify-start">
                    <div className="bg-gray-900/80 backdrop-blur rounded-2xl px-4 py-3 flex gap-1 border border-gray-800">
                      <span className="typing-dot w-2 h-2 bg-purple-400 rounded-full"></span>
                      <span className="typing-dot w-2 h-2 bg-purple-400 rounded-full"></span>
                      <span className="typing-dot w-2 h-2 bg-purple-400 rounded-full"></span>
                    </div>
                  </div>
                )}
              </div>
            </div>
            <div className="px-4 py-4 border-t border-gray-900/50 backdrop-blur-xl">
              <div className="max-w-3xl mx-auto">
                <InputBar
                  input={input}
                  setInput={setInput}
                  onSend={handleSend}
                  onKeyDown={handleKeyDown}
                  loading={loading}
                  inputRef={inputRef}
                />
                <p className="text-xs text-gray-600 text-center mt-2">
                  Ramoncito puede cometer errores. Verifica información importante.
                </p>
              </div>
            </div>
          </>
        )}
      </main>

      <style jsx>{`
        .stars {
          background-image: radial-gradient(1px 1px at 20% 30%, white, transparent),
            radial-gradient(1px 1px at 60% 70%, rgba(255,255,255,0.6), transparent),
            radial-gradient(1px 1px at 80% 10%, white, transparent),
            radial-gradient(1px 1px at 40% 80%, rgba(255,255,255,0.8), transparent),
            radial-gradient(1px 1px at 90% 50%, white, transparent),
            radial-gradient(1px 1px at 10% 60%, rgba(255,255,255,0.5), transparent),
            radial-gradient(2px 2px at 50% 50%, white, transparent),
            radial-gradient(1px 1px at 70% 20%, white, transparent);
          background-size: 200% 200%;
          opacity: 0.3;
          animation: drift 80s linear infinite;
        }
        @keyframes drift {
          from { background-position: 0 0; }
          to { background-position: 200% 200%; }
        }
      `}</style>
    </div>
  );
}

function InputBar({ input, setInput, onSend, onKeyDown, loading, inputRef, large }: {
  input: string;
  setInput: (v: string) => void;
  onSend: () => void;
  onKeyDown: (e: React.KeyboardEvent) => void;
  loading: boolean;
  inputRef: React.RefObject<HTMLTextAreaElement | null>;
  large?: boolean;
}) {
  return (
    <div className={`flex gap-2 bg-gray-900/70 backdrop-blur-xl rounded-2xl p-2 border border-gray-800 shadow-xl ${large ? "shadow-purple-500/10" : ""}`}>
      <textarea
        ref={inputRef}
        value={input}
        onChange={(e) => setInput(e.target.value)}
        onKeyDown={onKeyDown}
        placeholder={large ? "¿Qué quieres saber?" : "Mensaje a Ramoncito..."}
        rows={1}
        className={`flex-1 bg-transparent outline-none resize-none px-3 py-2 placeholder-gray-500 ${large ? "text-lg" : ""}`}
        disabled={loading}
        autoFocus
      />
      <button
        onClick={onSend}
        disabled={loading || !input.trim()}
        className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500 to-blue-500 flex items-center justify-center disabled:opacity-30 disabled:cursor-not-allowed hover:opacity-90 transition shadow-lg shadow-purple-500/30"
      >
        {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
      </button>
    </div>
  );
}

function SuggestionChip({ text, onClick }: { text: string; onClick: (text: string) => void }) {
  return (
    <button
      onClick={() => onClick(text)}
      className="text-left px-4 py-3 rounded-xl bg-gray-900/50 backdrop-blur hover:bg-gray-900/80 text-gray-300 text-sm transition border border-gray-800 hover:border-gray-700"
    >
      {text}
    </button>
  );
}

function GeneratedImage({ src }: { src: string }) {
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState(false);

  if (error) {
    return (
      <div className="mt-3 rounded-xl bg-gray-800 p-4 text-center text-sm text-gray-400">
        No se pudo generar la imagen. Intenta de nuevo.
      </div>
    );
  }

  return (
    <div className="mt-3 relative">
      {!loaded && (
        <div className="w-full h-64 rounded-xl bg-gradient-to-br from-purple-900/30 to-blue-900/30 flex flex-col items-center justify-center gap-3 border border-gray-800">
          <Loader2 className="w-8 h-8 animate-spin text-purple-400" />
          <p className="text-sm text-gray-400">Generando tu imagen...</p>
          <p className="text-xs text-gray-600">puede tardar 5-15 segundos</p>
        </div>
      )}
      <img
        src={src}
        alt="Generated"
        onLoad={() => setLoaded(true)}
        onError={() => setError(true)}
        className={`rounded-xl max-w-full ${loaded ? "block" : "hidden"}`}
      />
      {loaded && (
        <a
          href={src}
          download="nova-ai-image.png"
          target="_blank"
          rel="noopener noreferrer"
          className="absolute top-2 right-2 bg-black/60 backdrop-blur hover:bg-black/80 text-white text-xs px-3 py-1.5 rounded-lg transition"
        >
          Descargar
        </a>
      )}
    </div>
  );
}
