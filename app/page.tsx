"use client";

import { useState, useRef, useEffect } from "react";
import { Send, Sparkles, Loader2, Plus } from "lucide-react";

type Message = {
  role: "user" | "assistant";
  content: string;
  image?: string;
};

export default function Home() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  async function handleSend() {
    if (!input.trim() || loading) return;

    const userMsg: Message = { role: "user", content: input };
    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setInput("");
    setLoading(true);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: newMessages.map((m) => ({ role: m.role, content: m.content })),
        }),
      });
      const data = await res.json();
      setMessages([...newMessages, {
        role: "assistant",
        content: data.content,
        image: data.image,
      }]);
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
    setInput("");
  }

  return (
    <div className="flex flex-col h-screen">
      {/* Header */}
      <header className="border-b border-gray-800 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-purple-500 to-blue-500 flex items-center justify-center">
            <Sparkles className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-lg font-semibold">Nova AI</h1>
            <p className="text-xs text-gray-500">Tu asistente inteligente</p>
          </div>
        </div>
        <button
          onClick={newChat}
          className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-gray-400 hover:text-white hover:bg-gray-900 transition"
        >
          <Plus className="w-4 h-4" />
          <span className="hidden sm:inline">Nuevo chat</span>
        </button>
      </header>

      {/* Mensajes */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-6">
        <div className="max-w-3xl mx-auto space-y-6">
          {messages.length === 0 && (
            <div className="text-center py-20">
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-purple-500 to-blue-500 flex items-center justify-center mx-auto mb-4">
                <Sparkles className="w-8 h-8" />
              </div>
              <h2 className="text-2xl font-semibold mb-2">¿En qué puedo ayudarte?</h2>
              <p className="text-gray-500 max-w-md mx-auto">
                Pregúntame lo que quieras, pídeme que cree imágenes, o busca información en la web.
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-10 max-w-2xl mx-auto">
                <SuggestionCard
                  text="Explícame qué es la física cuántica"
                  onClick={(t) => { setInput(t); }}
                />
                <SuggestionCard
                  text="Crea una imagen de un dragón volando sobre montañas"
                  onClick={(t) => { setInput(t); }}
                />
                <SuggestionCard
                  text="Dame una receta rápida de pasta"
                  onClick={(t) => { setInput(t); }}
                />
                <SuggestionCard
                  text="Haz un dibujo de un gato astronauta"
                  onClick={(t) => { setInput(t); }}
                />
              </div>
            </div>
          )}

          {messages.map((msg, i) => (
            <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
              <div className={`max-w-[80%] rounded-2xl px-4 py-3 ${
                msg.role === "user"
                  ? "bg-blue-600 text-white"
                  : "bg-gray-900 text-gray-100"
              }`}>
                <p className="whitespace-pre-wrap">{msg.content}</p>
                {msg.image && <GeneratedImage src={msg.image} />}
              </div>
            </div>
          ))}

          {loading && (
            <div className="flex justify-start">
              <div className="bg-gray-900 rounded-2xl px-4 py-3 flex gap-1">
                <span className="typing-dot w-2 h-2 bg-gray-500 rounded-full"></span>
                <span className="typing-dot w-2 h-2 bg-gray-500 rounded-full"></span>
                <span className="typing-dot w-2 h-2 bg-gray-500 rounded-full"></span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Input */}
      <div className="border-t border-gray-800 px-4 py-4">
        <div className="max-w-3xl mx-auto">
          <div className="flex gap-2 bg-gray-900 rounded-2xl p-2">
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Pregunta, crea una imagen, o busca..."
              rows={1}
              className="flex-1 bg-transparent outline-none resize-none px-3 py-2"
              disabled={loading}
            />
            <button
              onClick={handleSend}
              disabled={loading || !input.trim()}
              className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500 to-blue-500 flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed hover:opacity-90 transition"
            >
              {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
            </button>
          </div>
          <p className="text-xs text-gray-600 text-center mt-2">
            Nova AI puede cometer errores. Verifica información importante.
          </p>
        </div>
      </div>
    </div>
  );
}

function SuggestionCard({ text, onClick }: { text: string; onClick: (text: string) => void }) {
  return (
    <button
      onClick={() => onClick(text)}
      className="text-left px-4 py-3 rounded-xl bg-gray-900 hover:bg-gray-800 text-gray-300 text-sm transition border border-gray-800"
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
        No se pudo generar la imagen. Intenta de nuevo con otra descripción.
      </div>
    );
  }

  return (
    <div className="mt-3 relative">
      {!loaded && (
        <div className="w-full h-64 rounded-xl bg-gray-800 flex flex-col items-center justify-center gap-3">
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
