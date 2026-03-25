import React, { useState, useRef, useEffect } from 'react';
import { GoogleGenAI, ThinkingLevel } from "@google/genai";
import { Send, Loader2, Bot, User, Sparkles, AlertCircle } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { GraphData } from '../utils/parser';

interface Message {
  role: 'user' | 'model';
  text: string;
}

interface Props {
  graphData: GraphData | null;
  repoUrl: string;
}

export default function AIAssistant({ graphData, repoUrl }: Props) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim() || loading) return;

    const userMessage: Message = { role: 'user', text: input };
    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setLoading(true);
    setError(null);

    try {
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
      
      // Prepare context about the repository
      let context = `You are an expert software architect analyzing the repository: ${repoUrl}.\n`;
      if (graphData) {
        context += `The repository has ${graphData.nodes.length} files and ${graphData.links.length} dependencies.\n`;
        const topFiles = [...graphData.nodes]
          .sort((a, b) => (b.metrics?.linesOfCode || 0) - (a.metrics?.linesOfCode || 0))
          .slice(0, 10)
          .map(n => `${n.path} (${n.metrics?.linesOfCode} LOC)`)
          .join(', ');
        context += `Top files by lines of code: ${topFiles}.\n`;
      }
      context += `\nUser question: ${input}`;

      const response = await ai.models.generateContent({
        model: "gemini-3.1-pro-preview",
        contents: context,
        config: {
          thinkingConfig: { thinkingLevel: ThinkingLevel.HIGH },
          systemInstruction: "You are a world-class software engineer and architect. Analyze the repository structure and provide deep insights. Use the provided graph data to understand dependencies and complexity."
        },
      });

      const modelText = response.text || "I'm sorry, I couldn't generate a response.";
      setMessages(prev => [...prev, { role: 'model', text: modelText }]);
    } catch (err: any) {
      console.error('AI Error:', err);
      setError(err.message || 'Failed to get a response from the AI.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-full bg-white border border-zinc-200 rounded-xl shadow-lg overflow-hidden font-sans">
      {/* Header */}
      <div className="px-6 py-4 border-b border-zinc-200 bg-zinc-50 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-indigo-500/10 rounded-lg">
            <Sparkles className="w-5 h-5 text-indigo-500" />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-zinc-900">AI Architect</h2>
            <p className="text-[10px] text-zinc-500 uppercase tracking-widest font-bold">Thinking Mode Enabled</p>
          </div>
        </div>
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-6 space-y-6">
        {messages.length === 0 && (
          <div className="h-full flex flex-col items-center justify-center text-center space-y-4 opacity-60">
            <Bot className="w-12 h-12 text-zinc-300" />
            <div className="max-w-xs">
              <p className="text-sm font-medium text-zinc-900">Ask anything about the repo</p>
              <p className="text-xs text-zinc-500 mt-1">"What is the most complex part of this project?" or "Explain the dependency structure."</p>
            </div>
          </div>
        )}

        {messages.map((msg, i) => (
          <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`flex gap-3 max-w-[85%] ${msg.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}>
              <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${msg.role === 'user' ? 'bg-zinc-100 border border-zinc-200' : 'bg-indigo-500 text-white shadow-sm shadow-indigo-500/20'}`}>
                {msg.role === 'user' ? <User size={16} /> : <Bot size={16} />}
              </div>
              <div className={`px-4 py-3 rounded-2xl text-sm leading-relaxed ${msg.role === 'user' ? 'bg-zinc-100 text-zinc-900 rounded-tr-none' : 'bg-white border border-zinc-200 text-zinc-800 shadow-sm rounded-tl-none'}`}>
                <div className="markdown-body">
                  <ReactMarkdown>{msg.text}</ReactMarkdown>
                </div>
              </div>
            </div>
          </div>
        ))}

        {loading && (
          <div className="flex justify-start">
            <div className="flex gap-3">
              <div className="w-8 h-8 rounded-full bg-indigo-500 text-white flex items-center justify-center animate-pulse">
                <Bot size={16} />
              </div>
              <div className="px-4 py-3 bg-white border border-zinc-200 rounded-2xl rounded-tl-none shadow-sm flex items-center gap-3">
                <Loader2 className="w-4 h-4 animate-spin text-indigo-500" />
                <span className="text-xs font-medium text-zinc-500">Architect is thinking...</span>
              </div>
            </div>
          </div>
        )}

        {error && (
          <div className="flex justify-center">
            <div className="flex items-center gap-2 px-4 py-2 bg-red-50 border border-red-100 text-red-600 rounded-lg text-xs font-medium">
              <AlertCircle size={14} />
              {error}
            </div>
          </div>
        )}
      </div>

      {/* Input */}
      <div className="p-4 border-t border-zinc-200 bg-white">
        <div className="relative">
          <input
            type="text"
            placeholder="Ask a question about the repository..."
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSend()}
            className="w-full pl-4 pr-12 py-3 bg-zinc-100 border border-zinc-200 rounded-xl text-sm text-zinc-900 placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500/50 transition-all"
          />
          <button
            onClick={handleSend}
            disabled={!input.trim() || loading}
            className="absolute right-2 top-1/2 -translate-y-1/2 p-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-sm shadow-indigo-500/20"
          >
            <Send size={16} />
          </button>
        </div>
      </div>
    </div>
  );
}
