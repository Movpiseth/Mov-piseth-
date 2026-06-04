/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef, useEffect } from "react";
import { VoiceProfile, ChatMessage } from "../types";
import { VoiceClonerProcessor } from "../lib/audioEngine";
import { Send, Sparkles, MessageSquare, Volume2, ShieldAlert, Check, RefreshCw } from "lucide-react";

interface GeminiAssistantProps {
  processor: VoiceClonerProcessor;
  activeVoice: VoiceProfile;
}

export default function GeminiAssistant({ processor, activeVoice }: GeminiAssistantProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: "welcome",
      role: "assistant",
      text: "សួស្តី! ខ្ញុំជាជំនួយការឆ្លាតវៃគំរូសម្លេងរបស់អ្នក។ សួរនាំអ្វីក៏បាន ខ្ញុំនឹងបន្លឺសម្លេងជាភាសាខ្មែរដូចសម្លេងសកម្មរបស់អ្នកទាំងស្រុង!",
      timestamp: new Date().toLocaleTimeString(),
    },
  ]);
  const [inputMsg, setInputMsg] = useState("");
  const [loading, setLoading] = useState(false);
  const [autoSpeak, setAutoSpeak] = useState(true);

  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, loading]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputMsg.trim() || loading) return;

    const userText = inputMsg.trim();
    const newUserMsg: ChatMessage = {
      id: `user-${Date.now()}`,
      role: "user",
      text: userText,
      timestamp: new Date().toLocaleTimeString(),
    };

    setMessages((prev) => [...prev, newUserMsg]);
    setInputMsg("");
    setLoading(true);

    try {
      const response = await fetch("/api/gemini/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          message: userText,
          voicePersona: `${activeVoice.name} (${activeVoice.description || 'Custom Cloned Voice'})`,
          language: "Khmer"
        }),
      });

      if (!response.ok || !response.headers.get("content-type")?.includes("application/json")) {
        throw new Error("ទទួលបានព័ត៌មានមិនត្រឹមត្រូវពី Server (Non-JSON Response)");
      }

      const data = await response.json();
      
      const assistantText = data.reply || "ខ្ញុំសុំទោស ខ្ញុំមិនអាចទាក់ទងប្រព័ន្ធបានទេ។";
      const newAssistantMsg: ChatMessage = {
        id: `ai-${Date.now()}`,
        role: "assistant",
        text: assistantText,
        timestamp: new Date().toLocaleTimeString(),
      };

      setMessages((prev) => [...prev, newAssistantMsg]);

      // If speak on, vocalize reply instantly
      if (autoSpeak) {
        processor.speakTTS(assistantText, {
          pitch: activeVoice.pitch,
          rate: activeVoice.rate,
          gender: activeVoice.gender,
          reverb: activeVoice.reverb,
        });
      }
    } catch (err) {
      console.error("Chat API error, reverting to offline rule-based response:", err);
      
      // Local fallback smart agent logic in Khmer
      const userLower = userText.toLowerCase();
      let assistantText = "សួស្តីបាទ! ខ្ញុំជាជំនួយការសម្លេងឆ្លាតវៃរបស់អ្នក។ តើខ្ញុំអាចជួយអ្វីដល់អ្នកនៅថ្ងៃនេះ?";
      
      if (userLower.includes("សួរ") || userLower.includes("hello") || userLower.includes("hi") || userLower.includes("សួស្តី")) {
        assistantText = "សួស្តីបាទ! រីករាយដែលបានជួបលោកអ្នក។ តើលោកអ្នកចង់ឱ្យខ្ញុំជួយអ្វីខ្លះដែរ?";
      } else if (userLower.includes("ឈ្មោះ") || userLower.includes("តើអ្នក") || userLower.includes("who")) {
        assistantText = `ខ្ញុំគឺជាជំនួយការសម្លេងសិប្បនិម្មិតផ្ទាល់ខ្លួនរបស់អ្នក ដែលត្រូវបានបើកដំណើរការដោយម៉ូដែល ${activeVoice.name} (Offline Backup Mode)។`;
      } else if (userLower.includes("ចម្រៀង") || userLower.includes("ភ្លេង") || userLower.includes("music") || userLower.includes("sing")) {
        assistantText = "ខ្ញុំអាចជួយអ្នកក្នុងការកាត់ត និងញែកសម្លេងចម្រៀង Vocals ជាមួយភ្លេង BGM តាមរយៈមុខងារ UVR5 Separator។";
      } else if (userLower.includes("អរគុណ") || userLower.includes("thanks") || userLower.includes("thank")) {
        assistantText = "បាទ! គ្មានបញ្ហាទេ គឺជាក្តីសោមនស្សរីករាយរបស់ខ្ញុំក្នុងការបម្រើ និងជួយសម្រួលដល់លោកអ្នក។";
      } else {
        assistantText = `ខ្ញុំបានទទួលសាររបស់អ្នក៖ "${userText}"។ ខ្ញុំជាជំនួយការសម្លេងរបស់ ${activeVoice.name} កំពុងដំណើរការក្នុងរបៀប Offline Backup ត្រៀមខ្លួនជួយលោកអ្នកជានិច្ច!`;
      }

      const newAssistantMsg: ChatMessage = {
        id: `ai-${Date.now()}`,
        role: "assistant",
        text: assistantText + " (Offline Mode)",
        timestamp: new Date().toLocaleTimeString(),
      };

      setMessages((prev) => [...prev, newAssistantMsg]);

      if (autoSpeak) {
        processor.speakTTS(assistantText, {
          pitch: activeVoice.pitch,
          rate: activeVoice.rate,
          gender: activeVoice.gender,
          reverb: activeVoice.reverb,
        });
      }
    } finally {
      setLoading(false);
    }
  };

  const speakMessage = (text: string) => {
    processor.speakTTS(text, {
      pitch: activeVoice.pitch,
      rate: activeVoice.rate,
      gender: activeVoice.gender,
      reverb: activeVoice.reverb,
    });
  };

  return (
    <div id="gemini-assistant-panel" className="bg-[#0d1117] rounded-xl p-6 border border-slate-850 shadow-sm flex flex-col h-[520px]">
      <div className="flex items-center justify-between border-b border-slate-800 pb-3 mb-4">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-lg bg-indigo-600/10 text-indigo-400 border border-indigo-500/20 flex items-center justify-center">
            <MessageSquare className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-white uppercase tracking-wider font-display">
              សន្ទនាជាមួយសម្លេងឌីជីថល (AI Voice Assistant)
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              គំរូសម្លេងឆ្លើយតប៖ <span className="font-bold text-indigo-400 font-mono">"{activeVoice.name}"</span>
            </p>
          </div>
        </div>

        {/* Speak Toggle switch */}
        <label className="flex items-center gap-2 cursor-pointer select-none">
          <span className="text-[10px] text-slate-500 font-mono uppercase tracking-wider hidden sm:inline">Auto-Read Out</span>
          <div className="relative">
            <input
              type="checkbox"
              checked={autoSpeak}
              onChange={() => setAutoSpeak(!autoSpeak)}
              className="sr-only peer"
            />
            <div className="w-10 h-6 bg-slate-800 rounded-full peer peer-checked:bg-indigo-600 after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:after:translate-x-full" />
          </div>
        </label>
      </div>

      {/* Bubble Chat Area */}
      <div className="flex-1 overflow-y-auto px-2 space-y-4 mb-4 scrollbar-none">
        {messages.map((msg) => {
          const isUser = msg.role === "user";

          return (
            <div
              key={msg.id}
              className={`flex flex-col ${isUser ? "items-end" : "items-start"}`}
            >
              <div className="text-[10px] text-slate-500 font-mono mb-1 px-1">
                {isUser ? "អ្នកប្រើប្រាស់ (You)" : `${activeVoice.name} (AI)`} • {msg.timestamp}
              </div>
              <div className="flex items-end gap-1.5 max-w-[85%] group">
                {!isUser && (
                  <button
                    onClick={() => speakMessage(msg.text)}
                    className="p-1.5 bg-[#161b22] hover:bg-[#1f242c] rounded-md text-slate-400 hover:text-white border border-slate-800 opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
                    title="បន្លឺសម្លេងឡើងវិញ"
                  >
                    <Volume2 className="w-3.5 h-3.5" />
                  </button>
                )}
                
                <div className={`p-3.5 rounded-xl text-sm leading-relaxed ${
                  isUser
                    ? "bg-indigo-600 text-white rounded-tr-none"
                    : "bg-[#0a0c10] border border-slate-800 text-slate-200 rounded-bl-none shadow-sm"
                }`}>
                  {msg.text}
                </div>
              </div>
            </div>
          );
        })}
        {loading && (
          <div className="flex flex-col items-start">
            <div className="text-[10px] text-slate-500 font-mono mb-1">{activeVoice.name} (AI) • កំពុងវាយស្វែងរក...</div>
            <div className="flex items-center gap-2 bg-[#0a0c10] border border-slate-800 text-slate-200 px-4 py-3 rounded-xl rounded-bl-none">
              <div className="flex space-x-1">
                <div className="w-2 h-2 bg-indigo-500 rounded-full animate-bounce delay-100" />
                <div className="w-2 h-2 bg-indigo-500 rounded-full animate-bounce delay-200" />
                <div className="w-2 h-2 bg-indigo-500 rounded-full animate-bounce delay-300" />
              </div>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Form Box */}
      <form onSubmit={handleSendMessage} className="flex gap-2">
        <input
          type="text"
          value={inputMsg}
          onChange={(e) => setInputMsg(e.target.value)}
          placeholder={`សួរទៅកាន់ ${activeVoice.name}... (ឧ. តើព្រះអាទិត្យវិលជុំវិញអ្វី?)`}
          className="flex-1 h-12 px-4 rounded-lg border border-slate-800 bg-[#0a0c10] text-[#c9d1d9] text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500"
          disabled={loading}
        />
        <button
          type="submit"
          className="w-12 h-12 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white flex items-center justify-center transition-colors active:scale-95 disabled:bg-[#161b22] disabled:text-slate-650 cursor-pointer"
          disabled={loading || !inputMsg.trim()}
        >
          <Send className="w-4 h-4 fill-current" />
        </button>
      </form>
    </div>
  );
}
