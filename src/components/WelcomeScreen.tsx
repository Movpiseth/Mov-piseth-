/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from "react";
import { Sparkles, Mic, FileText, AudioLines, Zap, Info, ArrowRight } from "lucide-react";

interface WelcomeScreenProps {
  onStart: () => void;
}

export default function WelcomeScreen({ onStart }: WelcomeScreenProps) {
  return (
    <div className="max-w-xl mx-auto bg-white rounded-3xl overflow-hidden shadow-2xl border border-slate-100 animate-fadeIn my-4">
      {/* Top Banner Gradient */}
      <div className="relative bg-gradient-to-b from-[#1e40af] via-[#2563eb] to-[#4f46e5] px-6 pt-10 pb-8 text-center text-white flex flex-col items-center">
        {/* Update Pill Badge */}
        <div className="bg-[#ffffff30] border border-white/20 backdrop-blur-md text-white text-[11px] font-bold px-3 py-1 rounded-full mb-4 flex items-center gap-1.5 font-display tracking-widest uppercase">
          <Zap className="w-3.5 h-3.5 text-yellow-300 animate-pulse fill-yellow-300" />
          New Update Live
        </div>

        {/* Title */}
        <div className="flex items-center gap-2 mb-4 justify-center">
          <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight font-display drop-shadow-md">
            RC Dubber AI Pro
          </h1>
          <span className="bg-[#facc15] text-[#0f172a] text-xs font-black px-2 py-0.5 rounded shadow-sm font-mono mt-1">
            V1.1.1
          </span>
        </div>

        {/* Soundwave Graphic Grid */}
        <div className="flex items-center justify-center gap-[3px] h-10 my-4">
          <div className="w-1 h-3 bg-white/40 rounded-full"></div>
          <div className="w-1 h-5 bg-white/50 rounded-full"></div>
          <div className="w-1 h-8 bg-white/70 rounded-full"></div>
          <div className="w-1 h-6 bg-white/80 rounded-full"></div>
          <div className="w-1 h-9 bg-white rounded-full"></div>
          <div className="w-1 h-4 bg-white/60 rounded-full"></div>
          <div className="w-1 h-7 bg-white/80 rounded-full"></div>
          <div className="w-1 h-10 bg-white rounded-full"></div>
          <div className="w-1 h-7 bg-white/80 rounded-full"></div>
          <div className="w-1 h-4 bg-white/60 rounded-full"></div>
          <div className="w-1 h-9 bg-white rounded-full"></div>
          <div className="w-1 h-6 bg-white/80 rounded-full"></div>
          <div className="w-1 h-8 bg-white/70 rounded-full"></div>
          <div className="w-1 h-5 bg-white/50 rounded-full"></div>
          <div className="w-1 h-3 bg-white/40 rounded-full"></div>
        </div>

        {/* Description */}
        <p className="text-[13px] md:text-sm text-blue-50 max-w-md leading-relaxed">
          សូមស្វាគមន៍មកកាន់ប្រព័ន្ធជំនាន់ចុងក្រោយបង្អស់សម្រាប់ការផលិតវីដេអូ និងបកប្រែសំឡេង
        </p>
      </div>

      {/* What's New Body */}
      <div className="p-6 md:p-8 space-y-6 bg-white text-slate-800">
        <h2 className="text-[15px] font-bold text-slate-700 flex items-center gap-2 border-b border-slate-100 pb-3">
          <Sparkles className="w-4 h-4 text-violet-600" />
          លក្ខណៈពិសេសថ្មីៗដែលត្រូវបានកែលម្អ (What's New)
        </h2>

        <div className="space-y-4">
          {/* Feature 1 */}
          <div className="flex gap-4 items-start p-3 hover:bg-slate-50 rounded-2xl transition-colors">
            <div className="w-10 h-10 rounded-xl bg-blue-50 border border-blue-100 flex items-center justify-center shrink-0">
              <Mic className="w-5 h-5 text-blue-650" />
            </div>
            <div>
              <h3 className="text-sm font-extrabold text-slate-900">UVR5 Separator & Track A3 Timeline</h3>
              <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                ញែកសំឡេងចម្រៀង និងសំឡេងភ្លេងផ្ទៃក្រោយដាច់ដោយឡែកពីគ្នា ព្រមទាំងបញ្ចូលទៅកាន់ Timeline Line A3 ដើម្បីងាយស្រួលកែសម្រួល។
              </p>
            </div>
          </div>

          {/* Feature 2 */}
          <div className="flex gap-4 items-start p-3 hover:bg-slate-50 rounded-2xl transition-colors">
            <div className="w-10 h-10 rounded-xl bg-rose-50 border border-rose-100 flex items-center justify-center shrink-0">
              <FileText className="w-5 h-5 text-rose-505" />
            </div>
            <div>
              <h3 className="text-sm font-extrabold text-slate-900">Microsoft Word Web Transcribe</h3>
              <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                បំប្លែងសំឡេងចម្រៀង/វីដេអូដែលបានញែករួចទៅជាអក្សរ Subtitle ស្វ័យប្រវត្ត លឿន និងមានប្រសិទ្ធភាពខ្ពស់បំផុត។
              </p>
            </div>
          </div>

          {/* Feature 3 */}
          <div className="flex gap-4 items-start p-3 hover:bg-slate-50 rounded-2xl transition-colors">
            <div className="w-10 h-10 rounded-xl bg-emerald-50 border border-emerald-100 flex items-center justify-center shrink-0">
              <AudioLines className="w-5 h-5 text-emerald-600" />
            </div>
            <div>
              <h3 className="text-sm font-extrabold text-slate-900">Dynamic Multi-Track Audio Mixer</h3>
              <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                គ្រប់គ្រងកម្រិតសំឡេង Audio Track ទាំងអស់រួមមាន៖ សំឡេងវីដេអូ សំឡេងកាត់ត BGM និងសំឡេងចម្រៀង Vocal Track ដោយឡែកពីគ្នាតាមចិត្តចង់។
              </p>
            </div>
          </div>

          {/* Feature 4 */}
          <div className="flex gap-4 items-start p-3 hover:bg-slate-50 rounded-2xl transition-colors">
            <div className="w-10 h-10 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center shrink-0">
              <Zap className="w-5 h-5 text-indigo-600" />
            </div>
            <div>
              <h3 className="text-sm font-extrabold text-slate-900">Robust Free-Fail Safe TTS System</h3>
              <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                ផលិតសំឡេងនិយាយពីអត្ថបទ (Text-to-Speech) កាន់តែលឿននិងឈប់មានបញ្ហាកាំង ឬទាញយកបរាជ័យ (Failed to fetch) ទៀតហើយ។
              </p>
            </div>
          </div>
        </div>

        {/* Advisory Tip */}
        <div className="p-4 bg-amber-50 rounded-2xl border border-amber-200/60 flex gap-3 text-amber-900 items-start">
          <Info className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
          <p className="text-xs leading-relaxed text-amber-800">
            <strong className="font-bold text-amber-950">ណែនាំ៖</strong> ប្រសិនបើលោកអ្នកធ្លាប់ជួបបញ្ហា <span className="font-mono bg-white px-1.5 py-0.5 rounded border border-amber-200">"Failed to fetch"</span> នៅពេលបំប្លែង ឬបង្កើតសំឡេង សូមកុំបារម្ភទៀតអី! ប្រព័ន្ធថ្មីនេះដំណើរការទាញយកទិន្នន័យដោយមានយន្តការធានា។
          </p>
        </div>

        {/* Start Button CTA */}
        <button
          onClick={onStart}
          className="w-full py-4 bg-gradient-to-r from-violet-600 to-indigo-600 text-white font-extrabold rounded-2xl flex items-center justify-center gap-2 shadow-lg shadow-violet-600/30 hover:shadow-violet-600/40 transform hover:-translate-y-0.5 transition-all text-sm uppercase tracking-wider cursor-pointer font-display"
        >
          ចាប់ផ្តើមប្រើប្រាស់ RC Dubber AI Pro v1.1.1 🚀
        </button>
      </div>
    </div>
  );
}
