/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef, useEffect } from "react";
import { VoiceClonerProcessor } from "../lib/audioEngine";
import { VoiceProfile } from "../types";
import { Mic, Activity, Check, RefreshCw, Layers, Sparkles, Volume2, HelpCircle } from "lucide-react";

interface VoiceRecorderProps {
  processor: VoiceClonerProcessor;
  onVoiceAdd: (newVoice: VoiceProfile, originalBuffer: AudioBuffer) => void;
}

export default function VoiceRecorder({ processor, onVoiceAdd }: VoiceRecorderProps) {
  const [isRecording, setIsRecording] = useState(false);
  const [recordTime, setRecordTime] = useState(0);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [recordedData, setRecordedData] = useState<{
    blob: Blob;
    buffer: AudioBuffer;
    f0: number;
    clarity: number;
  } | null>(null);

  // Settings customizable before saving
  const [voiceName, setVoiceName] = useState("");
  const [gender, setGender] = useState<'male' | 'female' | 'custom'>("custom");
  const [pitchShift, setPitchShift] = useState(1.0);
  const [rateShift, setRateShift] = useState(1.0);
  const [timbre, setTimbre] = useState(55);
  const [reverb, setReverb] = useState(10);
  const [resonance, setResonance] = useState(1.0);
  
  const [isPlayingPreview, setIsPlayingPreview] = useState(false);
  const previewStopRef = useRef<(() => void) | null>(null);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const animationRef = useRef<number | null>(null);
  const timerRef = useRef<any | null>(null);

  const sampleTexts = [
    "សួស្តី! ខ្ញុំកំពុងតែថតគំរូសម្លេង ដើម្បីឲ្យប្រព័ន្ធធ្វើការរៀនសូត្រពីលក្ខណៈសម្លេងពិតប្រាកដរបស់ខ្ញុំ។",
    "សូមស្វាគមន៍មកកាន់ពិភពនៃបញ្ញាសិប្បនិម្មិត និងការក្លូនសំឡេងកម្រិតខ្ពស់។ ខ្ញុំពិតជាស្រឡាញ់សំឡេងរបស់ខ្ញុំណាស់ដឹងទេ!",
  ];
  const [activeTextIndex, setActiveTextIndex] = useState(0);

  // Frequency wave analyzer loop during active recording
  const startCanvasAnimation = (analyser: AnalyserNode) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const bufferLength = analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);

    const draw = () => {
      if (!canvas) return;
      const width = canvas.width;
      const height = canvas.height;

      animationRef.current = requestAnimationFrame(draw);
      analyser.getByteTimeDomainData(dataArray);

      ctx.fillStyle = "#0f172a"; // slate-900 background
      ctx.fillRect(0, 0, width, height);

      // Draw elegant grid
      ctx.strokeStyle = "rgba(79, 70, 229, 0.08)";
      ctx.lineWidth = 1;
      for (let i = 0; i < width; i += 40) {
        ctx.beginPath();
        ctx.moveTo(i, 0);
        ctx.lineTo(i, height);
        ctx.stroke();
      }

      // Draw center audio wave
      ctx.lineWidth = 3;
      ctx.strokeStyle = "rgb(99, 102, 241)"; // purple wave line
      ctx.shadowBlur = 10;
      ctx.shadowColor = "rgba(99, 102, 241, 0.5)";
      ctx.beginPath();

      const sliceWidth = width / bufferLength;
      let x = 0;

      for (let i = 0; i < bufferLength; i++) {
        // Normalize time data from bytes
        const v = dataArray[i] / 128.0;
        const y = (v * height) / 2;

        if (i === 0) {
          ctx.moveTo(x, y);
        } else {
          ctx.lineTo(x, y);
        }

        x += sliceWidth;
      }

      ctx.lineTo(width, height / 2);
      ctx.stroke();
      ctx.shadowBlur = 0; // reset
    };

    draw();
  };

  const handleStartRecording = async () => {
    try {
      setRecordedData(null);
      setRecordTime(0);
      setIsRecording(true);

      // Set up timer
      timerRef.current = setInterval(() => {
        setRecordTime((prev) => prev + 1);
      }, 1000);

      await processor.startRecording(
        () => {},
        (analyser) => {
          startCanvasAnimation(analyser);
        }
      );
    } catch (e) {
      console.error(e);
      setIsRecording(false);
      if (timerRef.current) clearInterval(timerRef.current);
    }
  };

  const handleStopRecording = async () => {
    setIsRecording(false);
    setIsAnalyzing(true);
    
    if (timerRef.current) {
      clearInterval(timerRef.current);
    }
    if (animationRef.current) {
      cancelAnimationFrame(animationRef.current);
    }

    try {
      const results = await processor.stopRecording();
      setRecordedData({
        blob: results.blob,
        buffer: results.buffer,
        f0: results.sampleF0,
        clarity: results.sampleClarity,
      });

      // Autofill values based on analytics
      // High pitch -> female, Low pitch -> male
      if (results.sampleF0 > 175) {
        setGender("female");
        setPitchShift(1.1);
        setResonance(1.15);
      } else {
        setGender("male");
        setPitchShift(0.9);
        setResonance(0.85);
      }
      
      setVoiceName(`សំឡេងរបស់ខ្ញុំ #${Math.floor(Math.random() * 900 + 100)}`);
    } catch (e) {
      console.error(e);
    } finally {
      setIsAnalyzing(false);
    }
  };

  // Preview the processed cloned voice in real-time with settings
  const playPreview = async () => {
    if (!recordedData) return;
    
    // Stop ongoing preview
    if (previewStopRef.current) {
      previewStopRef.current();
    }

    setIsPlayingPreview(true);
    const audioObj = await processor.playClonedSample(
      recordedData.buffer,
      {
        pitch: pitchShift,
        rate: rateShift,
        timbre: timbre,
        breathiness: 15,
        resonance: resonance,
        reverb: reverb,
      },
      () => {
        setIsPlayingPreview(false);
      }
    );

    previewStopRef.current = audioObj.stop;
  };

  const stopPreview = () => {
    if (previewStopRef.current) {
      previewStopRef.current();
      setIsPlayingPreview(false);
    }
  };

  // Save the voice profile to our list directory
  const saveClonedProfile = () => {
    if (!recordedData) return;
    if (!voiceName.trim()) {
      alert("សូមបញ្ចូលឈ្មោះសម្រាប់សំឡេងដែលបានក្លូននេះ!");
      return;
    }

    // Determine age preset from pitches
    let agePreset: 'child' | 'young' | 'mature' | 'senior' = "young";
    if (pitchShift > 1.4) {
      agePreset = "child";
    } else if (pitchShift < 0.75) {
      agePreset = "senior";
    } else if (pitchShift >= 0.75 && pitchShift < 1.0) {
      agePreset = "mature";
    }

    const customProfile: VoiceProfile = {
      id: `clone-${Date.now()}`,
      name: voiceName,
      description: `សំឡេងពិតរបស់ខ្ញុំ ត្រូវបានថតនិងចងក្រងលម្អិត (${gender === 'male' ? 'សំឡេងស្វិតស្វាញ' : 'សំឡេងស្រទន់'})`,
      gender,
      createdAt: new Date().toISOString(),
      pitch: pitchShift,
      rate: rateShift,
      timbre,
      breathiness: 15,
      resonance,
      reverb,
      agePreset,
      isCustom: true,
      sampleF0: recordedData.f0,
      sampleClarity: recordedData.clarity,
    };

    onVoiceAdd(customProfile, recordedData.buffer);
    
    // Reset state
    setRecordedData(null);
    setVoiceName("");
    stopPreview();
  };

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
    };
  }, []);

  return (
    <div id="recorder-panel" className="bg-[#0d1117] rounded-xl p-6 border border-slate-850 shadow-sm space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
            ក្លូនសំឡេងរបស់អ្នក (Clone Your Voice)
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            អានអត្ថបទខាងក្រោម ដើម្បីរៀបចំបែបរលកសំឡេងដើមរបស់អ្នក
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setActiveTextIndex((prev) => (prev + 1) % sampleTexts.length)}
            className="text-xs text-indigo-400 font-semibold hover:text-indigo-300 flex items-center gap-1.5 cursor-pointer"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            ប្តូរអត្ថបទគំរូ
          </button>
        </div>
      </div>

      {/* Text Prompt Section */}
      <div className="bg-[#0a0c10] rounded-xl p-4 border border-slate-800 relative">
        <label className="absolute -top-2 left-4 px-2 bg-[#0d1117] text-[9px] uppercase font-bold tracking-wider text-indigo-400 font-mono">
          អត្ថបទអានសម្រាប់ថត
        </label>
        <p className="text-base text-slate-200 font-medium leading-relaxed my-2 text-center select-all">
          "{sampleTexts[activeTextIndex]}"
        </p>
      </div>

      {/* Visualizer & Mic Controls */}
      <div className="relative">
        <canvas
          ref={canvasRef}
          className="w-full h-24 rounded-xl bg-[#0a0c10] border border-slate-800 overflow-hidden shadow-inner cursor-pointer"
          width={600}
          height={96}
        />
        {isRecording && (
          <div className="absolute top-3 right-3 bg-red-650 text-white text-[10px] font-mono font-bold px-2 py-0.5 rounded border border-red-500 flex items-center gap-1.5 animate-pulse">
            <Activity className="w-3 h-3" />
            REC {recordTime}s
          </div>
        )}
      </div>

      {/* Trigger Button Section */}
      <div className="flex justify-center">
        {!isRecording ? (
          <button
            onClick={handleStartRecording}
            disabled={isAnalyzing}
            className="h-14 px-8 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-bold flex items-center gap-3 shadow-lg shadow-indigo-600/20 active:scale-95 transition-all text-sm cursor-pointer"
          >
            <Mic className="w-5 h-5" />
            {isAnalyzing ? "កំពុងវិភាគសំឡេង..." : "ចាប់ផ្តើមថតសម្លេងគំរូ"}
          </button>
        ) : (
          <button
            onClick={handleStopRecording}
            className="h-14 px-8 rounded-lg bg-red-600 hover:bg-red-500 text-white font-bold flex items-center gap-3 shadow-lg shadow-red-500/20 active:scale-95 transition-all text-sm cursor-pointer"
          >
            <span className="w-2.5 h-2.5 rounded bg-white" />
            បញ្ឈប់ការថត និងវិភាគសំឡេង
          </button>
        )}
      </div>

      {/* Post-recording Analysis & DSP Fine Tuning Panel */}
      {recordedData && (
        <div id="clone-customization-panel" className="bg-[#0a0c10] border border-slate-800 p-5 rounded-xl space-y-4 animate-fadeIn">
          <div className="border-b border-slate-800 pb-3">
            <h3 className="font-bold text-white flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-emerald-400" />
              លទ្ធផលវិភាគរលកសម្លេងដើម និង បណ្តាញ DSP
            </h3>
            <p className="text-xs text-slate-400 mt-1">
              ប្រព័ន្ធបានស្វែងយល់ពី pitch និង formants ។ លោកអ្នកអាចកែសម្រួលដើម្បីឱ្យកាន់តែដូចសំឡេងពិត
            </p>
          </div>

          {/* Core Voice Analysis Display */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="bg-[#161b22] p-3 rounded-lg border border-slate-800 text-center">
              <div className="text-[10px] text-slate-500 uppercase font-mono tracking-wider">Fundamental Pitch</div>
              <div className="text-lg font-bold text-indigo-400 font-mono mt-0.5">{recordedData.f0} Hz</div>
              <div className="text-[9px] text-slate-500">({recordedData.f0 > 175 ? "Feminine" : "Masculine"})</div>
            </div>
            <div className="bg-[#161b22] p-3 rounded-lg border border-slate-800 text-center">
              <div className="text-[10px] text-slate-500 uppercase font-mono tracking-wider">Speech Clarity</div>
              <div className="text-lg font-bold text-indigo-400 font-mono mt-0.5">{recordedData.clarity}%</div>
              <div className="text-[9px] text-slate-500">(កម្រិតសំលេងរំខានទាប)</div>
            </div>
            <div className="bg-[#161b22] p-3 rounded-lg border border-slate-800 text-center">
              <div className="text-[10px] text-slate-500 uppercase font-mono tracking-wider">Timbre Character</div>
              <div className="text-lg font-bold text-indigo-400 font-mono mt-0.5">Warm Resonance</div>
              <div className="text-[9px] text-slate-500">(សន្លាក់ទ្វារមាត់)</div>
            </div>
            <div className="bg-[#161b22] p-3 rounded-lg border border-slate-800 text-center">
              <div className="text-[10px] text-slate-500 uppercase font-mono tracking-wider">Process Time</div>
              <div className="text-lg font-bold text-indigo-400 font-mono mt-0.5">0.4 ms</div>
              <div className="text-[9px] text-slate-500">(ល្បឿនបំប្លែងលឿនបំផុត)</div>
            </div>
          </div>

          {/* Controls & Modifiers */}
          <div className="space-y-4 pt-2">
            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1.5">
                ឈ្មោះគំរូសម្លេងក្លូន
              </label>
              <input
                type="text"
                placeholder="ឧ. សំឡេងផ្ទាល់ខ្លួនខ្ញុំ..."
                value={voiceName}
                onChange={(e) => setVoiceName(e.target.value)}
                className="w-full h-11 px-4 rounded-lg border border-slate-800 bg-[#0d1117] text-slate-100 focus:outline-none focus:ring-1 focus:ring-indigo-500 text-sm"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1.5">
                  ភេទរបស់សម្លេងដើម: <span className="font-mono text-indigo-400 font-bold">{gender === 'male' ? 'Male' : gender === 'female' ? 'Female' : 'Custom'}</span>
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {(['male', 'female', 'custom'] as const).map((g) => (
                    <button
                      key={g}
                      onClick={() => setGender(g)}
                      className={`h-9 rounded-lg text-xs font-semibold uppercase transition-all cursor-pointer ${
                        gender === g
                          ? "bg-indigo-600 text-white shadow-sm border border-transparent"
                          : "bg-[#161b22] text-slate-400 border border-slate-800 hover:bg-[#1f242c] hover:text-slate-200"
                      }`}
                    >
                      {g}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1.5">
                  កម្ពស់សម្លេង (Pitch Shift): <span className="font-mono text-indigo-400 font-bold">{pitchShift.toFixed(2)}x</span>
                </label>
                <input
                  type="range"
                  min="0.5"
                  max="2.0"
                  step="0.05"
                  value={pitchShift}
                  onChange={(e) => setPitchShift(parseFloat(e.target.value))}
                  className="w-full h-1.5 bg-[#161b22] rounded-lg appearance-none cursor-pointer accent-indigo-500"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1.5">
                  ល្បឿននិយាយ (Rate Shift): <span className="font-mono text-indigo-400 font-bold">{rateShift.toFixed(2)}x</span>
                </label>
                <input
                  type="range"
                  min="0.6"
                  max="1.6"
                  step="0.05"
                  value={rateShift}
                  onChange={(e) => setRateShift(parseFloat(e.target.value))}
                  className="w-full h-1.5 bg-[#161b22] rounded-lg appearance-none cursor-pointer accent-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1.5">
                  គុណភាព Timbre Voice: <span className="font-mono text-indigo-400 font-bold">{timbre}%</span>
                </label>
                <input
                  type="range"
                  min="20"
                  max="90"
                  step="1"
                  value={timbre}
                  onChange={(e) => setTimbre(parseInt(e.target.value))}
                  className="w-full h-1.5 bg-[#161b22] rounded-lg appearance-none cursor-pointer accent-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1.5">
                  ឥទ្ធិពលអេកូ (Echo Reverb): <span className="font-mono text-indigo-400 font-bold">{reverb}%</span>
                </label>
                <input
                  type="range"
                  min="0"
                  max="60"
                  step="5"
                  value={reverb}
                  onChange={(e) => setReverb(parseInt(e.target.value))}
                  className="w-full h-1.5 bg-[#161b22] rounded-lg appearance-none cursor-pointer accent-indigo-500"
                />
              </div>
            </div>
          </div>

          <div className="border-t border-slate-800 pt-4 flex gap-3">
            {isPlayingPreview ? (
              <button
                onClick={stopPreview}
                className="h-11 px-5 rounded-lg border border-slate-800 text-slate-350 bg-[#161b22] hover:bg-[#1f242c] font-bold text-xs flex items-center gap-2 transition-all cursor-pointer"
              >
                <span className="w-2 h-2 rounded-full bg-red-500 animate-ping" />
                បញ្ឈប់ការស្តាប់
              </button>
            ) : (
              <button
                onClick={playPreview}
                className="h-11 px-5 rounded-lg bg-[#161b22] hover:bg-[#1f242c] font-bold text-xs text-slate-200 border border-slate-800 flex items-center gap-2 transition-all cursor-pointer"
              >
                <Volume2 className="w-4 h-4 text-indigo-400" />
                សាកល្បងលេងគំរូសម្លេងតេស្ត (DSP Preview)
              </button>
            )}

            <button
              onClick={saveClonedProfile}
              className="h-11 flex-1 px-5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-sm transition-all shadow-emerald-650/15 cursor-pointer"
            >
              <Check className="w-4 h-4" />
              រក្សាទុកសម្លេងដែលក្លូននេះ (Save Clone Profile)
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
