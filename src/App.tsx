/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from "react";
import { VoiceProfile } from "./types";
import { VoiceClonerProcessor } from "./lib/audioEngine";
import VoiceList from "./components/VoiceList";
import VoiceRecorder from "./components/VoiceRecorder";
import VoiceSynthesizer from "./components/VoiceSynthesizer";
import GeminiAssistant from "./components/GeminiAssistant";
import WelcomeScreen from "./components/WelcomeScreen";
import DubbingStudio from "./components/DubbingStudio";
import { Mic, Radio, MessageSquare, ShieldAlert, Sparkles, Volume2, HelpCircle, Gift, Layers } from "lucide-react";

const DEFAULT_VOICES: VoiceProfile[] = [
  {
    id: "sela",
    name: "សេលហ្វា (Sela)",
    description: "សំឡេងបុរសខ្មែរវ័យក្មេង និយាយស្វាហាប់ ស្វិតស្វាញ និងដាច់ច្បាស់",
    gender: "male",
    createdAt: "2026-06-04T00:00:00Z",
    pitch: 0.85,
    rate: 1.0,
    timbre: 45,
    breathiness: 12,
    resonance: 0.9,
    reverb: 5,
    agePreset: "young",
    isCustom: false,
  },
  {
    id: "socheata",
    name: "សុជាតា (Socheata)",
    description: "សំឡេងនារីខ្មែរផ្អែមល្ហែម ស្រទន់ សក្តិសមសម្រាប់រឿងនិទាន ឬព័ត៌មាន",
    gender: "female",
    createdAt: "2026-06-04T00:00:00Z",
    pitch: 1.30,
    rate: 1.05,
    timbre: 65,
    breathiness: 8,
    resonance: 1.25,
    reverb: 10,
    agePreset: "young",
    isCustom: false,
  },
  {
    id: "sambo",
    name: "លោកតា សំបូ (Grandpa Sambo)",
    description: "សំឡេងលោកតាចាស់ទុំ បទពិសោធន៍ បង្កប់ការទូន្មាន និងនិយាយយឺតៗល្មម",
    gender: "male",
    createdAt: "2026-06-04T00:00:00Z",
    pitch: 0.70,
    rate: 0.85,
    timbre: 30,
    breathiness: 25,
    resonance: 0.8,
    reverb: 8,
    agePreset: "senior",
    isCustom: false,
  },
  {
    id: "mary",
    name: "ប្អូនស្រី ម៉ារី (Little Mary)",
    description: "សំឡេងកុមារីតូច រហ័សរហួន គួរឱ្យស្រឡាញ់ ស្រួយស្រែះ និយាយលឿនបន្តិច",
    gender: "female",
    createdAt: "2026-06-04T00:00:00Z",
    pitch: 1.70,
    rate: 1.15,
    timbre: 75,
    breathiness: 5,
    resonance: 1.6,
    reverb: 12,
    agePreset: "child",
    isCustom: false,
  }
];

export default function App() {
  const [voices, setVoices] = useState<VoiceProfile[]>([]);
  const [selectedVoiceId, setSelectedVoiceId] = useState<string>("socheata");
  const [activeTab, setActiveTab] = useState<'welcome' | 'cloning' | 'tts' | 'chat' | 'dubbing'>("welcome");
  const [playingVoiceId, setPlayingVoiceId] = useState<string | null>(null);

  // Buffer sources store for custom recordings
  const voiceBuffersRef = useRef<Record<string, AudioBuffer>>({});
  const processorRef = useRef<VoiceClonerProcessor | null>(null);

  // Initialize AudioEngine Processor
  if (!processorRef.current) {
    processorRef.current = new VoiceClonerProcessor();
  }

  // Load state and cached voices from localStorage
  useEffect(() => {
    const cached = localStorage.getItem("voice_cloner_custom_profiles");
    if (cached) {
      try {
        const parsed = JSON.parse(cached) as VoiceProfile[];
        setVoices([...DEFAULT_VOICES, ...parsed]);
      } catch (e) {
        setVoices(DEFAULT_VOICES);
      }
    } else {
      setVoices(DEFAULT_VOICES);
    }
  }, []);

  const handleSelectVoice = (id: string) => {
    setSelectedVoiceId(id);
  };

  const activeVoice = voices.find(v => v.id === selectedVoiceId) || DEFAULT_VOICES[1];

  // Callback to register newly cloned voice profile from Recorder
  const handleAddNewVoice = (newVoice: VoiceProfile, originalBuffer: AudioBuffer) => {
    // 1. Cache the audio buffer in heap
    voiceBuffersRef.current[newVoice.id] = originalBuffer;

    // 2. Add profile to local state and update local store
    const nextVoices = [...voices, newVoice];
    setVoices(nextVoices);
    setSelectedVoiceId(newVoice.id);

    // Filter custom profiles only to store in localStorage
    const customs = nextVoices.filter(v => v.isCustom);
    localStorage.setItem("voice_cloner_custom_profiles", JSON.stringify(customs));
  };

  // Delete profile
  const handleDeleteVoice = (id: string) => {
    const nextVoices = voices.filter(v => v.id !== id);
    setVoices(nextVoices);
    if (selectedVoiceId === id) {
      setSelectedVoiceId("socheata"); // default
    }

    const customs = nextVoices.filter(v => v.isCustom);
    localStorage.setItem("voice_cloner_custom_profiles", JSON.stringify(customs));

    // Cleanup buffers
    delete voiceBuffersRef.current[id];
  };

  // Playback test trigger on voice list
  const handlePlayTest = async (voice: VoiceProfile) => {
    const processor = processorRef.current;
    if (!processor) return;

    setPlayingVoiceId(voice.id);

    // If it's a custom cloned voice and we have the recording in-mem
    const customBuffer = voiceBuffersRef.current[voice.id];
    if (voice.isCustom && customBuffer) {
      await processor.playClonedSample(
        customBuffer,
        {
          pitch: voice.pitch,
          rate: voice.rate,
          timbre: voice.timbre,
          breathiness: voice.breathiness,
          resonance: voice.resonance,
          reverb: voice.reverb,
        },
        () => {
          setPlayingVoiceId(null);
        }
      );
    } else {
      // Standard synthesizer prompt fallback for default voices
      const phrase = `សួស្តីបាទ! ខ្ញុំជា ${voice.name}។ សម្លេងនេះត្រូវបានកំណត់ និងត្រៀមរៀបចំជាស្រេច។`;
      processor.speakTTS(
        phrase,
        {
          pitch: voice.pitch,
          rate: voice.rate,
          gender: voice.gender,
          reverb: voice.reverb,
        },
        () => {},
        () => {
          setPlayingVoiceId(null);
        }
      );
    }
  };

  return (
    <div className="min-h-screen bg-[#0a0c10] text-slate-300 font-sans pb-12 transition-colors duration-300">
      {/* Top Professional Navigation Bar */}
      <nav className="h-16 flex items-center justify-between px-6 bg-[#0d1117] border-b border-slate-800 sticky top-0 z-50">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center shadow-lg shadow-indigo-500/20 text-white">
            <Mic className="w-4.5 h-4.5" />
          </div>
          <span className="text-lg font-bold tracking-tight text-white font-display">
            RC DUBBER <span className="text-indigo-500">AI PRO</span>
            <span className="text-[10px] font-bold px-1.5 py-0.5 bg-slate-800 text-slate-300 rounded border border-slate-700 ml-2 font-mono">
              V1.1.1
            </span>
          </span>
        </div>

        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
            <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 font-mono hidden sm:inline-block">
              AI Core Online
            </span>
          </div>
          <div className="flex items-center gap-2 bg-[#161b22] px-3 py-1.5 rounded-lg border border-slate-800">
            <Volume2 className="w-3.5 h-3.5 text-indigo-400" />
            <span className="text-xs font-mono text-slate-300">
              សកម្ម៖ <strong className="text-white font-semibold">{activeVoice.name}</strong>
            </span>
          </div>
        </div>
      </nav>

      <div className="max-w-6xl mx-auto px-4 pt-8 space-y-6">
        {/* Dynamic Studio Welcome Title Header */}
        <header className="flex flex-col gap-1.5 pb-4 border-b border-slate-900">
          <div className="flex items-center gap-2 text-xs font-bold text-indigo-400 font-display uppercase tracking-widest">
            <Sparkles className="w-4.5 h-4.5" />
            Voice Synthesis Studio
          </div>
          <h2 className="text-3xl font-extrabold text-white tracking-tight font-display">
            ស្ទូឌីយោក្លូនសំឡេង និងបង្កើតការសន្ទនាវៃឆ្លាត
          </h2>
          <p className="text-sm text-slate-400 max-w-2xl leading-relaxed">
            បច្ចេកវិទ្យាក្លូនសំឡេងកម្រិតខ្ពស់។ អាចកែតម្រូវ pitch ល្បឿននិយាយ និង spectral resonance របស់សម្លេងដើម ដើម្បីបង្កើតជាស្គ្រីប ឬសន្ទនាឆ្លើយឆ្លងជាមួយ Gemini AI។
          </p>
        </header>

        {/* Informative Gemini API Banner */}
        <div className="bg-indigo-950/20 border border-indigo-500/20 rounded-xl p-4 flex items-start gap-3 text-indigo-200">
          <ShieldAlert className="w-5 h-5 text-indigo-400 shrink-0 mt-0.5" />
          <div className="text-xs space-y-1">
            <span className="font-bold text-white">ព័ត៌មានជំនួយ (Setup Note):</span> សម្រាប់ការសន្ទនា AI និងការបង្កើតស្គ្រីបនិយាយដោយសេរី ត្រូវប្រាកដថាអ្នកបានបញ្ចូល <code className="bg-[#161b22] border border-slate-800 px-1.5 py-0.5 rounded font-mono text-indigo-300">GEMINI_API_KEY</code> ទៅក្នុង <span className="font-bold text-white">Settings &gt; Secrets</span>។ ប្រព័ន្ធថតសម្លេង និងបំប្លែងល្បឿន pitch ក្រៅបណ្តាញ (DSP offline) ដំណើរការជាធម្មតា។
          </div>
        </div>

        {/* Primary Interactive Tab Controller */}
        <div className="flex border-b border-slate-800 gap-1 overflow-x-auto scrollbar-none">
          <button
            onClick={() => setActiveTab("welcome")}
            className={`px-5 py-3.5 text-xs md:text-sm font-bold flex items-center gap-2 border-b-2 transition-all shrink-0 cursor-pointer ${
              activeTab === "welcome"
                ? "border-indigo-500 text-white font-bold bg-indigo-500/5"
                : "border-transparent text-slate-400 hover:text-slate-200"
            }`}
          >
            <Sparkles className="w-4 h-4 text-indigo-400 animate-pulse" />
            ព័ត៌មានថ្មី V1.1.1 (What's New)
          </button>
          <button
            onClick={() => setActiveTab("dubbing")}
            className={`px-5 py-3.5 text-xs md:text-sm font-bold flex items-center gap-2 border-b-2 transition-all shrink-0 cursor-pointer ${
              activeTab === "dubbing"
                ? "border-indigo-500 text-white font-bold bg-indigo-500/5"
                : "border-transparent text-slate-400 hover:text-slate-200"
            }`}
          >
            <Layers className="w-4 h-4 text-indigo-400" />
            ស្ទូឌីយោ Dubbing Pro (Dubbing Suite)
          </button>
          <button
            onClick={() => setActiveTab("cloning")}
            className={`px-5 py-3.5 text-xs md:text-sm font-bold flex items-center gap-2 border-b-2 transition-all shrink-0 cursor-pointer ${
              activeTab === "cloning"
                ? "border-indigo-500 text-white font-bold bg-indigo-500/5"
                : "border-transparent text-slate-400 hover:text-slate-200"
            }`}
          >
            <Mic className="w-4 h-4" />
            ថតក្លូន និងគ្រប់គ្រងសម្លេង (Clone Studio)
          </button>
          <button
            onClick={() => setActiveTab("tts")}
            className={`px-5 py-3.5 text-xs md:text-sm font-bold flex items-center gap-2 border-b-2 transition-all shrink-0 cursor-pointer ${
              activeTab === "tts"
                ? "border-indigo-500 text-white font-bold bg-indigo-500/5"
                : "border-transparent text-slate-400 hover:text-slate-200"
            }`}
          >
            <Radio className="w-4 h-4" />
            បំប្លែងអត្ថបទទៅជាសំឡេង (Speak Playground)
          </button>
          <button
            onClick={() => setActiveTab("chat")}
            className={`px-5 py-3.5 text-xs md:text-sm font-bold flex items-center gap-2 border-b-2 transition-all shrink-0 cursor-pointer ${
              activeTab === "chat"
                ? "border-indigo-500 text-white font-bold bg-indigo-500/5"
                : "border-transparent text-slate-400 hover:text-slate-200"
            }`}
          >
            <MessageSquare className="w-4 h-4" />
            ជំនួយការសន្ទនាគ្រូ AI (AI Chat Companion)
          </button>
        </div>

        {/* Tab Views Routing Panel */}
        <main className="space-y-6">
          {activeTab === "welcome" && (
            <WelcomeScreen onStart={() => setActiveTab("dubbing")} />
          )}

          {activeTab === "dubbing" && (
            <DubbingStudio
              processor={processorRef.current}
              activeVoice={activeVoice}
            />
          )}

          {activeTab === "cloning" && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
              <div className="lg:col-span-4 lg:sticky lg:top-20">
                <VoiceList
                  voices={voices}
                  selectedVoiceId={selectedVoiceId}
                  onSelectVoice={handleSelectVoice}
                  onDeleteVoice={handleDeleteVoice}
                  onPlayTest={handlePlayTest}
                  playingVoiceId={playingVoiceId}
                />
              </div>
              <div className="lg:col-span-8">
                <VoiceRecorder
                  processor={processorRef.current}
                  onVoiceAdd={handleAddNewVoice}
                />
              </div>
            </div>
          )}

          {activeTab === "tts" && (
            <VoiceSynthesizer
              processor={processorRef.current}
              activeVoice={activeVoice}
            />
          )}

          {activeTab === "chat" && (
            <GeminiAssistant
              processor={processorRef.current}
              activeVoice={activeVoice}
            />
          )}
        </main>

        {/* Standard Footer */}
        <footer className="text-center text-[10px] text-slate-500 pt-8 border-t border-slate-800/80 flex flex-col sm:flex-row justify-between items-center gap-2 font-mono uppercase tracking-wider">
          <div>© ២០២៦ VOXCLONE Neural Engine v5.0. រក្សាសិទ្ធិគ្រប់យ៉ាង។</div>
          <div className="flex gap-4">
            <span className="hover:text-slate-300 cursor-pointer transition-colors">ลក្ខខណ្ឌប្រើប្រាស់</span>
            <span className="hover:text-slate-300 cursor-pointer transition-colors">គោលការណ៍ឯកជនភាព</span>
          </div>
        </footer>
      </div>
    </div>
  );
}
