/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from "react";
import { VoiceProfile } from "../types";
import { VoiceClonerProcessor } from "../lib/audioEngine";
import { Play, Square, FileText, Sparkles, Volume2, Radio, Check, RefreshCw } from "lucide-react";

interface VoiceSynthesizerProps {
  processor: VoiceClonerProcessor;
  activeVoice: VoiceProfile;
}

export default function VoiceSynthesizer({ processor, activeVoice }: VoiceSynthesizerProps) {
  const [text, setText] = useState("សួស្តី! នេះគឺជាសំឡេងដែលត្រូវបានក្លូន និងរៀបចំដោយជោគជ័យតាមប្រព័ន្ធឌីជីថល។");
  const [isSpeaking, setIsSpeaking] = useState(false);
  
  // Script Generator Settings
  const [scriptTopic, setScriptTopic] = useState("");
  const [scriptType, setScriptType] = useState("announcement");
  const [isGeneratingScript, setIsGeneratingScript] = useState(false);

  // Custom Preset templates
  const presets = [
    {
      label: "ប្រកាសព័ត៌មាន (News Announcement)",
      text: "សេចក្តីប្រកាសព័ត៌មាន៖ សូមស្វាគមន៍ការមកដល់របស់គណៈប្រតិភូជាន់ខ្ពស់ និងការបើកសម្ពោធគម្រោងបច្ចេកវិទ្យាថ្មី។"
    },
    {
      label: "ការផ្សព្វផ្សាយទំនិញ (Promotion Ads)",
      text: "ប្រូម៉ូសិនពិសេសអស្ចារ្យ! បញ្ចុះតម្លៃរហូតដល់ សែសិបភាគរយ សម្រាប់រាល់ការជាវរបស់របរប្រើប្រាស់ទូទៅគ្រប់ប្រភេទ ចាប់ពីថ្ងៃនេះតទៅ។"
    },
    {
      label: "មនោសញ្ចេតនា (Narrative)",
      text: "ខ្យល់ជំនោររដូវរំហើយ បក់ល្វើយៗនាំយកមកនូវក្តីសង្ឃឹម និងភាពស្រស់ស្រាយមកកាន់ភូមិឋានដ៏សុខសាន្តរបស់យើង។"
    },
    {
      label: "ជំនួយការទូទៅ (Helpful Assist)",
      text: "ខ្ញុំរីករាយណាស់ក្នុងការជួយលោកអ្នកនៅថ្ងៃនេះ។ តើមានកិច្ចការអ្វីដែលខ្ញុំអាចប្រតិបត្តិជូនលោកអ្នកបានដែរបាទ?"
    }
  ];

  const handleSpeak = () => {
    if (!text.trim()) return;

    setIsSpeaking(true);
    processor.speakTTS(
      text,
      {
        pitch: activeVoice.pitch,
        rate: activeVoice.rate,
        gender: activeVoice.gender,
        reverb: activeVoice.reverb,
      },
      () => {
        // started
      },
      () => {
        setIsSpeaking(false);
      }
    );
  };

  const handleStop = () => {
    if (window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }
    setIsSpeaking(false);
  };

  // Connects with server side API to ask Gemini to compose an advanced short script 
  const handleGenerateScript = async () => {
    if (!scriptTopic.trim()) {
      alert("សូមបញ្ចូលប្រធានបទដែលអ្នកចង់ឱ្យបំផុសគំនិត!");
      return;
    }

    setIsGeneratingScript(true);
    try {
      const response = await fetch("/api/gemini/generate-script", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          topic: scriptTopic,
          voiceVibe: activeVoice.description || "friendly voice",
          scriptType: scriptType,
        }),
      });

      if (!response.ok || !response.headers.get("content-type")?.includes("application/json")) {
        throw new Error("ទទួលបានព័ត៌មានមិនត្រឹមត្រូវពី Server (Non-JSON Response)");
      }

      const data = await response.json();
      if (data.script) {
        setText(data.script);
        setScriptTopic(""); // clear
      } else {
        throw new Error("ស្គ្រីបគ្មានទិន្នន័យ");
      }
    } catch (err: any) {
      console.warn("Script Generation API error, reverting to local fallback template:", err);
      
      // Local fallback template matching scriptType
      let fallbackText = "";
      if (scriptType === "podcast_intro") {
        fallbackText = `សូមស្វាគមន៍មកកាន់ការផ្សាយផតឃែស្ថពិសេសប្រចាំថ្ងៃ។ ថ្ងៃនេះយើងនឹងលើកយកប្រធានបទដ៏ជក់ចិត្តមួយមកពិភាក្សា និងចែករំលែកជូនបងប្អូនទាំងអស់គ្នា គឺ៖ "${scriptTopic}" ជាមួយគំនិតល្អៗជាច្រើន។`;
      } else if (scriptType === "news_anchor") {
        fallbackText = `សេចក្តីរាយការណ៍ពិសេសទើបទទួលបាន៖ ទាក់ទងនឹងប្រធានបទ "${scriptTopic}" យើងខ្ញុំសង្កេតឃើញថាមានការចាប់អារម្មណ៍យ៉ាងខ្លាំងពីសំណាក់មហាជនក្នុងសប្តាហ៍នេះ។`;
      } else if (scriptType === "poem") {
        fallbackText = `សម្លេងខ្យល់ពព្រិចស្រណោះកាយ... នឹកដល់ប្រធានបទចរចារចម្ងាយ "${scriptTopic}" សែនស្រណោះស្រណោកក្នុងឱរ៉ា សង្ឃឹមជួបភ័ក្ត្រាថ្ងៃខាងមុខ។`;
      } else {
        fallbackText = `នេះគឺជាការបង្ហាញសាកល្បងសម្លេងពិសេសរបស់ ${activeVoice.name} លើប្រធានបទ៖ "${scriptTopic}"។ ប្រព័ន្ធប្រកបដោយផាសុកភាព និងមានប្រសិទ្ធភាពខ្ពស់បំផុត។`;
      }

      setText(fallbackText);
      setScriptTopic(""); // clear
    } finally {
      setIsGeneratingScript(false);
    }
  };

  return (
    <div id="tts-panel" className="bg-[#0d1117] border border-slate-850 rounded-xl p-6 shadow-sm space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between border-b border-slate-800 pb-4 gap-2">
        <div>
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <Radio className="w-5 h-5 text-indigo-400 animate-pulse" />
            បំប្លែងអត្ថបទរបស់លោកអ្នកទៅជាសំឡេង (Text-To-Speech Playground)
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            ប្រើប្រាស់សំឡេងសកម្ម៖ <span className="font-bold text-indigo-400 font-mono">"{activeVoice.name}"</span>
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Interactive Playground */}
        <div className="lg:col-span-2 space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-400 mb-1.5 flex items-center gap-1.5">
              <FileText className="w-4 h-4 text-slate-505" />
              បញ្ចូលអត្ថបទខ្មែរ ឬអង់គ្លេសដែលចង់ឱ្យនិយាយ
            </label>
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              className="w-full h-40 p-4 rounded-lg border border-slate-800 bg-[#0a0c10] text-[#c9d1d9] text-base focus:outline-none focus:ring-1 focus:ring-indigo-500 leading-relaxed resize-none"
              placeholder="សូមវាយបញ្ចូលអត្ថបទនៅទីនេះ..."
            />
          </div>

          {/* Preset Buttons Grid */}
          <div>
            <span className="block text-xs font-semibold text-slate-500 mb-2 uppercase tracking-wide font-mono">
              ពុម្ពអត្ថបទរហ័ស (Quick Templates)
            </span>
            <div className="flex flex-wrap gap-2">
              {presets.map((preset, index) => (
                <button
                  key={index}
                  onClick={() => setText(preset.text)}
                  className="px-3 py-1.5 bg-[#161b22] hover:bg-[#1f242c] text-indigo-400 hover:text-indigo-305 rounded-md text-xs font-bold border border-slate-800 transition-all cursor-pointer"
                >
                  {preset.label}
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-3 pt-2">
            {!isSpeaking ? (
              <button
                onClick={handleSpeak}
                className="h-12 flex-1 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-sm flex items-center justify-center gap-2 shadow-lg shadow-indigo-605/15 active:scale-95 transition-all cursor-pointer"
              >
                <Play className="w-4 h-4 fill-current" />
                បន្លឺឡើងតាមសំឡេងក្លូន (Speak Now)
              </button>
            ) : (
              <button
                onClick={handleStop}
                className="h-12 flex-1 rounded-lg bg-red-650 hover:bg-red-550 text-white font-bold text-sm flex items-center justify-center gap-2 active:scale-95 transition-all animate-pulse cursor-pointer"
              >
                <Square className="w-4 h-4 fill-current" />
                បញ្ឈប់ការនិយាយ (Silence)
              </button>
            )}
          </div>
        </div>

        {/* Right Gemini AI Script Generator Utility */}
        <div className="bg-[#0a0c10] rounded-lg p-4 border border-slate-800 flex flex-col justify-between space-y-4">
          <div>
            <div className="flex items-center gap-1.5 text-xs font-bold text-indigo-400 uppercase tracking-widest font-mono mb-2">
              <Sparkles className="w-4 h-4" />
              ប្រព័ន្ធនិពន្ធស្គ្រីប AI
            </div>
            <h3 className="font-bold text-white text-sm">
              តែងនិពន្ធស្គ្រីបឆ្លាតវៃជាមួយ Gemini
            </h3>
            <p className="text-xs text-slate-400 mt-1 leading-relaxed">
              សូមបញ្ចូលប្រធានបទមួយ (ឧ. រឿងនិទានកូនក្មេង, ការលក់កាហ្វេ, កំណាព្យខ្លី) ឱ្យ AI និពន្ធស្គ្រីបខ្មែរឲ្យរហ័ស។
            </p>
          </div>

          <div className="space-y-3">
            <div>
              <label className="block text-[11px] font-bold text-slate-400 mb-1 uppercase tracking-tight font-mono">
                ប្រភេទសាច់រឿង / កិច្ចការ
              </label>
              <select
                value={scriptType}
                onChange={(e) => setScriptType(e.target.value)}
                className="w-full h-9 px-2 text-xs rounded border border-slate-800 bg-[#0d1117] text-slate-200 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              >
                <option value="announcement">សេចក្តីប្រកាស (Announcement)</option>
                <option value="story">រឿងនិទានខ្លី (Short Bedtime Story)</option>
                <option value="marketing">ផ្សាយពាណិជ្ជកម្ម (Marketing Pitch)</option>
                <option value="joke">រឿងកំប្លែងសប្បាយៗ (Quick Joke)</option>
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-400 mb-1 uppercase tracking-tight font-mono">
                ប្រធានបទ ឬសំណៅខ្លឹមសារ
              </label>
              <input
                type="text"
                placeholder="ឧ. ដំបូន្មានថែរក្សាសុខភាព, បើកលក់អាហារដ្ឋាន..."
                value={scriptTopic}
                onChange={(e) => setScriptTopic(e.target.value)}
                className="w-full h-10 px-3 text-xs rounded border border-slate-800 bg-[#0d1117] text-slate-250 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
            </div>
          </div>

          <button
            onClick={handleGenerateScript}
            disabled={isGeneratingScript}
            className={`w-full h-10 rounded-lg font-bold text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
              isGeneratingScript
                ? "bg-[#161b22] text-slate-600 border border-slate-800 cursor-not-allowed"
                : "bg-indigo-600/10 hover:bg-indigo-650/20 text-indigo-300 border border-indigo-500/20"
            }`}
          >
            {isGeneratingScript ? (
              <>
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                កំពុងតែងស្គ្រីប...
              </>
            ) : (
              <>
                <Sparkles className="w-3.5 h-3.5" />
                បង្កើតស្គ្រីបនិយាយរហ័ស (Compose Script)
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
