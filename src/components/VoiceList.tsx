/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from "react";
import { VoiceProfile } from "../types";
import { Mic, User, Volume2, Trash2, Heart, Sparkles } from "lucide-react";

interface VoiceListProps {
  voices: VoiceProfile[];
  selectedVoiceId: string;
  onSelectVoice: (id: string) => void;
  onDeleteVoice: (id: string) => void;
  onPlayTest: (voice: VoiceProfile) => void;
  playingVoiceId: string | null;
}

export default function VoiceList({
  voices,
  selectedVoiceId,
  onSelectVoice,
  onDeleteVoice,
  onPlayTest,
  playingVoiceId,
}: VoiceListProps) {
  const [favorites, setFavorites] = useState<string[]>([]);

  const toggleFavorite = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (favorites.includes(id)) {
      setFavorites(favorites.filter(favId => favId !== id));
    } else {
      setFavorites([...favorites, id]);
    }
  };

  const getGenderBadge = (gender: 'male' | 'female' | 'custom') => {
    switch (gender) {
      case "male":
        return <span className="px-2 py-0.5 text-[10px] font-semibold rounded bg-blue-950/40 text-blue-400 border border-blue-900/40 font-mono">បុរស (Male)</span>;
      case "female":
        return <span className="px-2 py-0.5 text-[10px] font-semibold rounded bg-pink-950/40 text-pink-400 border border-pink-900/40 font-mono">នារី (Female)</span>;
      default:
        return <span className="px-2 py-0.5 text-[10px] font-semibold rounded bg-purple-950/40 text-purple-400 border border-purple-900/40 font-mono">ពិសេស (Custom)</span>;
    }
  };

  const getAgeLabel = (age: string) => {
    switch (age) {
      case "child": return "កុមារ (Child)";
      case "young": return "យុវវ័យ (Young)";
      case "mature": return "ចាស់ទុំ (Adult)";
      case "senior": return "ចាស់ (Senior)";
      default: return age;
    }
  };

  return (
    <div id="voice-list-container" className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold uppercase tracking-widest text-slate-500 flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-indigo-500 animate-pulse" />
          បញ្ជីសំឡេងគំរូ ({voices.length})
        </h2>
        <div className="text-[10px] text-slate-500 font-mono bg-[#161b22] px-2 py-0.5 rounded border border-slate-800">
          SUITE MODELS
        </div>
      </div>

      <div className="flex flex-col gap-3">
        {voices.map((voice) => {
          const isSelected = voice.id === selectedVoiceId;
          const isPlaying = voice.id === playingVoiceId;
          const isFav = favorites.includes(voice.id);

          return (
            <div
              key={voice.id}
              id={`voice-card-${voice.id}`}
              onClick={() => onSelectVoice(voice.id)}
              className={`relative cursor-pointer rounded-xl border p-4 transition-all duration-300 flex flex-col justify-between ${
                isSelected
                  ? "border-indigo-500 bg-[#161b22]/70 shadow-lg shadow-indigo-500/5 ring-1 ring-indigo-500/20"
                  : "border-slate-800 hover:border-slate-700 bg-[#0d1117] hover:shadow-md"
              }`}
            >
              <div>
                {/* Voice Card Header */}
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div className="flex items-center gap-3">
                    <div className={`w-9 h-9 rounded-lg flex items-center justify-center transition-colors ${
                      isSelected ? "bg-indigo-600 text-white" : "bg-[#161b22] text-slate-400 border border-slate-800"
                    }`}>
                      {voice.isCustom ? <Mic className="w-4 h-4" /> : <User className="w-4 h-4" />}
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-white flex items-center gap-2">
                        {voice.name}
                        {voice.isCustom && (
                          <span className="text-[9px] bg-indigo-500/20 text-indigo-400 font-mono font-bold px-1.5 py-0.5 rounded uppercase tracking-wider">
                            CLONED
                          </span>
                        )}
                      </h3>
                      <p className="text-xs text-slate-400 line-clamp-1 mt-0.5">{voice.description}</p>
                    </div>
                  </div>

                  <button
                    onClick={(e) => toggleFavorite(voice.id, e)}
                    className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                      isFav ? "text-red-500 hover:bg-[#161b22]" : "text-slate-600 hover:bg-[#161b22] hover:text-slate-400"
                    }`}
                  >
                    <Heart className="w-4 h-4 fill-current" />
                  </button>
                </div>

                {/* Characteristics Badges */}
                <div className="flex flex-wrap gap-1.5 my-3">
                  {getGenderBadge(voice.gender)}
                  <span className="px-2 py-0.5 text-[10px] font-mono font-medium rounded bg-slate-800/80 text-slate-300 border border-slate-705/30">
                    {getAgeLabel(voice.agePreset)}
                  </span>
                  {voice.sampleF0 && (
                    <span className="px-2 py-0.5 text-[10px] font-mono font-medium rounded bg-indigo-950/40 text-indigo-300 border border-indigo-900/40">
                      {voice.sampleF0} Hz
                    </span>
                  )}
                  {voice.sampleClarity && (
                    <span className="px-2 py-0.5 text-[10px] font-mono font-medium rounded bg-[#0f172a] text-emerald-400 border border-slate-850">
                      ច្បាស់: {voice.sampleClarity}%
                    </span>
                  )}
                </div>
              </div>

              {/* Specs & Play Action Block */}
              <div className="border-t border-slate-800 pt-3 mt-2 flex items-center justify-between">
                <div className="flex items-center gap-3 text-[10px] text-slate-500 font-mono tracking-tight">
                  <span>Pitch: {voice.pitch.toFixed(2)}x</span>
                  <span>Rate: {voice.rate.toFixed(2)}x</span>
                </div>

                <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
                  <button
                    onClick={() => onPlayTest(voice)}
                    disabled={isPlaying}
                    className={`px-3 py-1.5 text-[11px] rounded-lg font-bold flex items-center gap-1.5 transition-all duration-200 cursor-pointer ${
                      isPlaying
                        ? "bg-emerald-600 text-white animate-pulse"
                        : "bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700"
                    }`}
                  >
                    <Volume2 className="w-3.5 h-3.5" />
                    {isPlaying ? "កំពុងលេង..." : "ស្តាប់សាកល្បង"}
                  </button>

                  {voice.isCustom && (
                    <button
                      onClick={() => onDeleteVoice(voice.id)}
                      className="p-1.5 text-red-500 hover:bg-red-950/20 rounded-lg transition-colors cursor-pointer"
                      title="លុបសំឡេងក្លូននេះ"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
