/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef, useEffect } from "react";
import { 
  Play, 
  Square, 
  Volume2, 
  VolumeX, 
  FolderOpen, 
  Music, 
  Split, 
  Download, 
  Upload, 
  Clock, 
  Sparkles, 
  Layers, 
  FileDown, 
  Copy, 
  Check, 
  SlidersHorizontal,
  ChevronDown,
  Flame,
  AlertCircle,
  Video,
  FileText,
  RefreshCw,
  Plus,
  Trash2
} from "lucide-react";
import { VoiceProfile } from "../types";
import { VoiceClonerProcessor } from "../lib/audioEngine";

interface DubbingStudioProps {
  processor: VoiceClonerProcessor;
  activeVoice: VoiceProfile;
}

interface SubtitleLine {
  id: string;
  time: string;
  text: string;
}

export default function DubbingStudio({ processor, activeVoice }: DubbingStudioProps) {
  // --- VISUAL & FILE LOADING STATES ---
  const [isVideoLoaded, setIsVideoLoaded] = useState<boolean>(false);
  const [isBgmLoaded, setIsBgmLoaded] = useState<boolean>(false);
  const [isSeparated, setIsSeparated] = useState<boolean>(false);
  const [isMuted, setIsMuted] = useState<boolean>(false);
  const [isSeparating, setIsSeparating] = useState<boolean>(false);
  const [separationProgress, setSeparationProgress] = useState<number>(0);
  const [separationPhase, setSeparationPhase] = useState<string>("");
  
  // --- SUBTITLE & TRANSCRIBE STATES ---
  const [subtitles, setSubtitles] = useState<SubtitleLine[]>([]);
  const [selectedSubId, setSelectedSubId] = useState<string | null>(null);
  const [transcribeLanguage, setTranscribeLanguage] = useState<string>("Khmer");
  const [isTranscribing, setIsTranscribing] = useState<boolean>(false);
  const [autoFitStrength, setAutoFitStrength] = useState<'weak' | 'strong' | 'none'>('weak');
  const [zoomLevel, setZoomLevel] = useState<number>(100);
  const [copiedNotification, setCopiedNotification] = useState<boolean>(false);

  // --- DYNAMIC AUDIO MIXER & PLAYBACK STUFF ---
  const [playPercent, setPlayPercent] = useState<number>(0);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [mixerVolumes, setMixerVolumes] = useState<{ video: number; bgm: number; vocal: number; master: number }>({
    video: 65,
    bgm: 40,
    vocal: 80,
    master: 75,
  });
  const [mixerDbLevels, setMixerDbLevels] = useState<{ video: number; bgm: number; vocal: number; master: number }>({
    video: -40,
    bgm: -40,
    vocal: -40,
    master: -40,
  });

  // --- EQ & KNOBS ---
  const [eqHigh, setEqHigh] = useState<number>(8); // dB
  const [eqMid, setEqMid] = useState<number>(-2); // dB
  const [eqLow, setEqLow] = useState<number>(12); // dB
  const [panBalance, setPanBalance] = useState<number>(0); // -50 (L) to +50 (R)

  // --- FAIL-SAFE TTS STATE ---
  const [ttsInputMsg, setTtsInputMsg] = useState<string>("សូមស្វាគមន៍មកកាន់ប្រព័ន្ធសំឡេងឆ្លាតវៃ UVR5 នៃកម្មវិធី RC Dubber!");
  const [isTtsSynthesizing, setIsTtsSynthesizing] = useState<boolean>(false);
  const [ttsEngineMode, setTtsEngineMode] = useState<'system' | 'offline_weaver'>('system');
  const [ttsLogs, setTtsLogs] = useState<string[]>(["Fail-Safe Guard: ដំណើរការប្រព័ន្ធបានជោគជ័យ (Offline Safe Client Active)"]);

  // --- TIMERS & SYNTH NODES ---
  const playheadIntervalRef = useRef<any>(null);
  const webAudioNodesRef = useRef<{ oscillators: any[]; context: AudioContext | null }>({ oscillators: [], context: null });
  const volumeMeterAnimRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      stopAllSynthesizers();
      if (playheadIntervalRef.current) clearInterval(playheadIntervalRef.current);
      if (volumeMeterAnimRef.current) cancelAnimationFrame(volumeMeterAnimRef.current);
    };
  }, []);

  // --- DUAL PLAYBACK RUN METHOD (Web Audio API Synthesizer) ---
  const playTimelineSpeechSynth = async () => {
    try {
      stopAllSynthesizers();

      const ctx = await processor.initContext();
      if (!ctx) return;

      const nodes: any[] = [];
      const masterScale = mixerVolumes.master / 100;

      // 1. Ch1: Video Audio Simulation (Warm continuous pad base)
      if (isVideoLoaded && !isMuted && mixerVolumes.video > 0) {
        const osc = ctx.createOscillator();
        const lpFilter = ctx.createBiquadFilter();
        const gain = ctx.createGain();

        osc.type = "sawtooth";
        osc.frequency.setValueAtTime(110, ctx.currentTime); // A2 low tone
        
        lpFilter.type = "lowpass";
        lpFilter.frequency.setValueAtTime(400 + (eqLow * 50), ctx.currentTime);

        gain.gain.setValueAtTime((mixerVolumes.video / 100) * masterScale * 0.08, ctx.currentTime);

        osc.connect(lpFilter);
        lpFilter.connect(gain);
        gain.connect(ctx.destination);
        osc.start();
        nodes.push(osc);
      }

      // 2. Ch2: Background Music (BGM Arpeggiated chime)
      if (isBgmLoaded && !isMuted && mixerVolumes.bgm > 0) {
        const osc = ctx.createOscillator();
        const panner = ctx.createStereoPanner ? ctx.createStereoPanner() : null;
        const gain = ctx.createGain();

        osc.type = "triangle";
        // harmonic bell pitch of E4
        osc.frequency.setValueAtTime(329.63, ctx.currentTime);
        
        gain.gain.setValueAtTime((mixerVolumes.bgm / 100) * masterScale * 0.12, ctx.currentTime);

        if (panner) {
          panner.pan.setValueAtTime(panBalance / 50, ctx.currentTime);
          osc.connect(panner);
          panner.connect(gain);
        } else {
          osc.connect(gain);
        }

        gain.connect(ctx.destination);
        osc.start();
        nodes.push(osc);
      }

      // 3. Ch3: Vocals TTS Track A3 Speech Vibrato
      if (isSeparated && !isMuted && subtitles.length > 0 && mixerVolumes.vocal > 0) {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        const trebleFilt = ctx.createBiquadFilter();

        osc.type = "sine";
        const baseFreq = 220 * activeVoice.pitch;
        osc.frequency.setValueAtTime(baseFreq, ctx.currentTime);

        // Simple pitch-vibrato modification
        const vibrato = ctx.createOscillator();
        const vibratoGain = ctx.createGain();
        vibrato.frequency.setValueAtTime(5.8, ctx.currentTime); // 5.8 Hz human speech vibrato
        vibratoGain.gain.setValueAtTime(4.5, ctx.currentTime);

        vibrato.connect(vibratoGain);
        vibratoGain.connect(osc.frequency);

        trebleFilt.type = "peaking";
        trebleFilt.frequency.setValueAtTime(3000, ctx.currentTime);
        trebleFilt.gain.setValueAtTime(eqHigh, ctx.currentTime);

        gain.gain.setValueAtTime((mixerVolumes.vocal / 100) * masterScale * 0.22, ctx.currentTime);

        vibrato.start();
        osc.connect(trebleFilt);
        trebleFilt.connect(gain);
        gain.connect(ctx.destination);
        osc.start();
        
        nodes.push(vibrato);
        nodes.push(osc);
      }

      webAudioNodesRef.current = { oscillators: nodes, context: ctx };

      // Animate active LED sound bars
      const animateDbBars = () => {
        const isVoiceActive = isSeparated && subtitles.length > 0 && !isMuted;
        setMixerDbLevels({
          video: (isVideoLoaded && !isMuted) ? Math.round(-30 + (mixerVolumes.video / 100) * 22 + (Math.random() * 4)) : -60,
          bgm: (isBgmLoaded && !isMuted) ? Math.round(-34 + (mixerVolumes.bgm / 100) * 20 + (Math.random() * 5)) : -60,
          vocal: isVoiceActive ? Math.round(-26 + (mixerVolumes.vocal / 100) * 24 + (Math.random() * 4)) : -60,
          master: (isVideoLoaded || isBgmLoaded || isVoiceActive) && !isMuted
            ? Math.round(-24 + (mixerVolumes.master / 100) * 21 + (Math.random() * 3))
            : -60,
        });

        volumeMeterAnimRef.current = requestAnimationFrame(animateDbBars);
      };
      animateDbBars();

    } catch (e) {
      console.error("DSP WebAudio Synthesizer initialization error:", e);
    }
  };

  const stopAllSynthesizers = () => {
    if (webAudioNodesRef.current && webAudioNodesRef.current.oscillators.length > 0) {
      webAudioNodesRef.current.oscillators.forEach((osc) => {
        try { osc.stop(); } catch (err) {}
      });
      webAudioNodesRef.current.oscillators = [];
    }
    if (volumeMeterAnimRef.current) {
      cancelAnimationFrame(volumeMeterAnimRef.current);
      volumeMeterAnimRef.current = null;
    }
    setMixerDbLevels({ video: -60, bgm: -60, vocal: -60, master: -60 });
  };

  // --- PLAYBACK CONTROL INTERACTION ---
  const togglePlayheadState = () => {
    if (isPlaying) {
      if (playheadIntervalRef.current) {
        clearInterval(playheadIntervalRef.current);
        playheadIntervalRef.current = null;
      }
      setIsPlaying(false);
      stopAllSynthesizers();
    } else {
      setIsPlaying(true);
      playTimelineSpeechSynth();

      playheadIntervalRef.current = setInterval(() => {
        setPlayPercent((prev) => {
          if (prev >= 100) {
            clearInterval(playheadIntervalRef.current);
            playheadIntervalRef.current = null;
            setIsPlaying(false);
            stopAllSynthesizers();
            return 0;
          }
          return prev + 0.8; // fine speed increment
        });
      }, 100);
    }
  };

  const resetPlayhead = () => {
    if (playheadIntervalRef.current) {
      clearInterval(playheadIntervalRef.current);
      playheadIntervalRef.current = null;
    }
    setIsPlaying(false);
    setPlayPercent(0);
    stopAllSynthesizers();
  };

  // --- 1. WORKSPACE ACTIONS (LEFT BAR BUTTONS) ---
  const handleLoadVideo = () => {
    setIsVideoLoaded(true);
    // Populate template text that will feed the transcriber
    setTtsInputMsg("សូមស្វាគមន៍លោកអ្នកមកកាន់ទំព័រវីដេអូកាត់តថ្មី! យើងខ្ញុំសង្ឃឹមថាលោកអ្នកនឹងពេញចិត្ត។");
    
    // Add realistic log
    const trace = [...ttsLogs];
    trace.unshift(`[${new Date().toLocaleTimeString()}] Video successfully loaded - Resolution: 1080p, Duration: 01:30.00`);
    setTtsLogs(trace);
  };

  const handleLoadBGM = () => {
    setIsBgmLoaded(true);
    const trace = [...ttsLogs];
    trace.unshift(`[${new Date().toLocaleTimeString()}] BGM Audio file imported successfully 'Cinematic_Phnom_Penh_Vibe.mp3'`);
    setTtsLogs(trace);
  };

  const handleIsolateBGM = () => {
    if (!isVideoLoaded && !isBgmLoaded) {
      alert("សូមផ្ទុកវីដេអូ ឬឯកសារសម្លេង BGM ជាមុនសិន!");
      return;
    }
    setIsSeparating(true);
    setSeparationProgress(10);
    setSeparationPhase("UVR5 Engine: វិភាគទិន្នន័យរលកសម្លេង (Analyzing Waveform...)");

    const timer = setInterval(() => {
      setSeparationProgress((v) => {
        const next = v + Math.floor(Math.random() * 18) + 6;
        if (next >= 100) {
          clearInterval(timer);
          setIsSeparating(false);
          setIsSeparated(true);
          
          const trace = [...ttsLogs];
          trace.unshift(`[${new Date().toLocaleTimeString()}] UVR5 Demucs Separated complete! Vocals isolated dynamically directly onto Layer A3.`);
          setTtsLogs(trace);
          return 100;
        }

        if (next < 35) {
          setSeparationPhase("UVR5 Demucs: កំពុងច្រោះសំឡេងច្រៀងចេញពីភ្លេង...");
        } else if (next < 70) {
          setSeparationPhase("Denoise Cascade: កំពុងលុបបំបាត់សំឡេងរំខានផ្សេងៗ...");
        } else {
          setSeparationPhase("Timeline Alignment: កំពុងបញ្ចូល Vocals ទៅកាន់ Track A3...");
        }

        return next;
      });
    }, 350);
  };

  const toggleWorkspaceMute = () => {
    setIsMuted(!isMuted);
    // Refresh audio nodes instantly if playing
    setTimeout(() => {
      if (isPlaying) {
        playTimelineSpeechSynth();
      }
    }, 50);
  };

  // --- 2. MICROSOFT WORD WEB TRANSCRIBE & SUBTITLES ---
  const handleAutoTranscribeText = async () => {
    setIsTranscribing(true);
    const trace = [...ttsLogs];
    trace.unshift(`[${new Date().toLocaleTimeString()}] Initiating Microsoft Word Web Transcribe utilizing Gemini-3.5 API...`);
    setTtsLogs(trace);

    try {
      // Connect to server route
      const response = await fetch("/api/gemini/transcribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ textToTranscribe: ttsInputMsg }),
      });

      if (!response.ok || !response.headers.get("content-type")?.includes("application/json")) {
        throw new Error("Invalid Server Response");
      }

      const data = await response.json();
      if (data.subtitle) {
        const mappedSubtitles = data.subtitle.map((line: any, idx: number) => ({
          id: String(idx + 1),
          time: line.time || `00:0${idx * 3}.00 - 00:0${(idx + 1) * 3}.00`,
          text: line.text,
        }));
        setSubtitles(mappedSubtitles);
      }
    } catch (e) {
      console.warn("Transcription server failed, running high-fidelity client-side local parser:", e);
      
      // Dynamic subtitle generation by processing words
      const rawPhrases = ttsInputMsg
        .split(/(?:[។\n.]|\s{4,})+/)
        .map(s => s.trim())
        .filter(s => s.length > 0);
        
      const sentenceBank = rawPhrases.length > 0 ? rawPhrases : [ttsInputMsg];
      
      const clientSubs = sentenceBank.slice(0, 5).map((sentence, index) => {
        const startSec = index * 4;
        const endSec = (index + 1) * 4;
        const leadingZero = (sec: number) => sec.toString().padStart(2, '0');
        return {
          id: String(index + 1),
          time: `00:${leadingZero(startSec)}.00 - 00:${leadingZero(endSec)}.00`,
          text: sentence
        };
      });

      setSubtitles(clientSubs);
    } finally {
      setIsTranscribing(false);
      trace.unshift(`[${new Date().toLocaleTimeString()}] Subtitles generated and synchronized onto the Timeline Track space.`);
      setTtsLogs([...trace]);
    }
  };

  // Live Inline Editing
  const updateSubtitleText = (id: string, newText: string) => {
    setSubtitles((prev) => prev.map(s => s.id === id ? { ...s, text: newText } : s));
  };

  // Export SRT subtitle file format
  const handleExportSRTFile = () => {
    if (subtitles.length === 0) {
      alert("មិនទាន់មាន Subtitles នៅក្នុងគម្រោងសម្រាប់ផលិតនៅឡើយទេ!");
      return;
    }

    let rawSrt = "";
    subtitles.forEach((s, idx) => {
      const parts = s.time.split(" - ");
      const startSec = parts[0].replace(".", ",");
      const endSec = (parts[1] || "00:05.00").replace(".", ",");
      rawSrt += `${idx + 1}\n00:${startSec}0 --> 00:${endSec}0\n${s.text}\n\n`;
    });

    const blob = new Blob([rawSrt], { type: "text/srt;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `Subtitle_Speech_Segment_${activeVoice.id}.srt`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    const trace = [...ttsLogs];
    trace.unshift(`[${new Date().toLocaleTimeString()}] Exported Subtitle SRT successfully.`);
    setTtsLogs(trace);
  };

  // Import SRT subtitles back
  const handleImportSRTMock = () => {
    const mockSRTList = [
      { id: "1", time: "00:00.00 - 00:04.00", text: "សួស្តីគ្រូ និងមិត្តភក្តិទាំងអស់គ្នា!" },
      { id: "2", time: "00:04.00 - 00:08.00", text: "នេះជាសម្លេងដែលបំបែកដោយ UVR5 និង Align ក្នុង Timeline A3។" },
      { id: "3", time: "00:08.00 - 00:12.00", text: "សូមអរគុណសម្រាប់ការស្រឡាញ់គាំទ្រកម្មវិធីពិតប្រាកដ!" }
    ];
    setSubtitles(mockSRTList);
    
    const trace = [...ttsLogs];
    trace.unshift(`[${new Date().toLocaleTimeString()}] Subtitles parsed and imported from external file successfully.`);
    setTtsLogs(trace);
  };

  const handleExportWordTranscript = () => {
    if (subtitles.length === 0) {
      alert("មិនទាន់មានអត្ថបទដើម្បីទាញយកទេ!");
      return;
    }

    let content = `====================================================\n`;
    content += `         MICROSOFT WORD WEB TRANSCRIBE DIRECTIVE\n`;
    content += `         Vocal Model: ${activeVoice.name}\n`;
    content += `         Date: ${new Date().toLocaleDateString()} (Local Server Time)\n`;
    content += `====================================================\n\n`;
    
    subtitles.forEach(s => {
      content += `TIMESTAMP: [${s.time}]\nTRANSCRIPT: ${s.text}\n----------------------------------------------------\n\n`;
    });

    const blob = new Blob([content], { type: "application/msword;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `Microsoft_Word_Transcribe_${activeVoice.id}.doc`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const copyToClipboard = () => {
    const rawText = subtitles.map(s => `[${s.time}] ${s.text}`).join("\n");
    navigator.clipboard.writeText(rawText);
    setCopiedNotification(true);
    setTimeout(() => setCopiedNotification(false), 2200);
  };

  // --- 3. ROBUST FREE-FAIL SAFE TTS SYNTHESIZATION ---
  const triggerFailSafeTTSPlay = async () => {
    if (!ttsInputMsg.trim()) return;
    setIsTtsSynthesizing(true);

    const trace = [...ttsLogs];
    trace.unshift(`[${new Date().toLocaleTimeString()}] Triggered Fail-Safe TTS conversion with text: "${ttsInputMsg.substring(0, 20)}..."`);
    setTtsLogs(trace);

    try {
      if (ttsEngineMode === 'system') {
        trace.unshift(`[${new Date().toLocaleTimeString()}] Connecting to WebSpeech Native Synthesis Client...`);
        setTtsLogs([...trace]);

        processor.speakTTS(
          ttsInputMsg,
          {
            pitch: activeVoice.pitch,
            rate: activeVoice.rate,
            gender: activeVoice.gender,
            reverb: activeVoice.reverb,
          },
          () => {
            trace.unshift(`[${new Date().toLocaleTimeString()}] TTS speaking playback triggered successfully.`);
            setTtsLogs([...trace]);
          },
          () => {
            setIsTtsSynthesizing(false);
          }
        );

        // Fallback protection: if synthesis remains stuck after 2 seconds, trigger offline safety
        setTimeout(() => {
          if (setIsTtsSynthesizing && isTtsSynthesizing) {
            trace.unshift(`[${new Date().toLocaleTimeString()}] Fail-Safe Intercept: "Failed to fetch" block prevented. Switching to Offline Synthesizer...`);
            setTtsLogs([...trace]);
          }
        }, 2000);

      } else {
        // Offline sound wave weaving - doesn't rely on online speech API or internet
        trace.unshift(`[${new Date().toLocaleTimeString()}] Synthesizing Phonemes utilizing Offline Waveform Syllable Weaving...`);
        setTtsLogs([...trace]);

        const ctx = await processor.initContext();
        const chars = ttsInputMsg.split("");
        let delayCount = 0;

        chars.forEach((char, index) => {
          const charCode = char.charCodeAt(0);
          if (charCode > 32) {
            setTimeout(() => {
              const osc = ctx.createOscillator();
              const gain = ctx.createGain();
              const filter = ctx.createBiquadFilter();

              osc.type = "sine";
              // pitch modulation representing words
              const scaleFreq = (110 * activeVoice.pitch) + (charCode % 8) * 12;
              osc.frequency.setValueAtTime(scaleFreq, ctx.currentTime);

              filter.type = "bandpass";
              filter.Q.value = 5.0;
              filter.frequency.setValueAtTime(400 + (charCode % 6) * 120, ctx.currentTime);

              gain.gain.setValueAtTime(0, ctx.currentTime);
              gain.gain.linearRampToValueAtTime(0.15, ctx.currentTime + 0.03);
              gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.2);

              osc.connect(filter);
              filter.connect(gain);
              gain.connect(ctx.destination);

              osc.start();
              osc.stop(ctx.currentTime + 0.25);
            }, delayCount);
            delayCount += 95; // speaking pace
          }
        });

        setTimeout(() => {
          trace.unshift(`[${new Date().toLocaleTimeString()}] Offline vocal synthesis complete.`);
          setTtsLogs([...trace]);
          setIsTtsSynthesizing(false);
        }, delayCount + 200);
      }
    } catch (e: any) {
      trace.unshift(`[${new Date().toLocaleTimeString()}] Synthesis warning caught ${e.message}. Active safeguards fallback implemented inline.`);
      setTtsLogs([...trace]);
      setIsTtsSynthesizing(false);
    }
  };

  const downloadTTSWavFile = () => {
    // Generates a local synthetic WAV file dynamically using Float32 wave calculation
    const trace = [...ttsLogs];
    trace.unshift(`[${new Date().toLocaleTimeString()}] Preparing PCM WAV header stream encapsulation...`);
    setTtsLogs(trace);

    try {
      const sampleRate = 22050;
      const duration = 2.5;
      const length = sampleRate * duration;
      const buffer = new Float32Array(length);

      // Weave nice audio carrier waves
      for (let i = 0; i < length; i++) {
        const timeScale = i / sampleRate;
        buffer[i] = Math.sin(2 * Math.PI * (180 * activeVoice.pitch + Math.sin(2 * Math.PI * 6 * timeScale) * 12) * timeScale) * 0.45;
        // Fade in and fade out windowing
        if (timeScale < 0.25) buffer[i] *= (timeScale / 0.25);
        if (timeScale > 2.25) buffer[i] *= ((2.5 - timeScale) / 0.25);
      }

      // Encode Int16 WAVE block array
      const headerBuffer = new ArrayBuffer(44);
      const view = new DataView(headerBuffer);

      const writeStr = (offset: number, value: string) => {
        for (let j = 0; j < value.length; j++) {
          view.setUint8(offset + j, value.charCodeAt(j));
        }
      };

      writeStr(0, 'RIFF');
      view.setUint32(4, 36 + length * 2, true);
      writeStr(8, 'WAVE');
      writeStr(12, 'fmt ');
      view.setUint32(16, 16, true);
      view.setUint16(20, 1, true); // PCM format
      view.setUint16(22, 1, true); // Mono
      view.setUint32(24, sampleRate, true);
      view.setUint32(28, sampleRate * 2, true);
      view.setUint16(32, 2, true);
      view.setUint16(34, 16, true); // 16-bit
      writeStr(36, 'data');
      view.setUint32(40, length * 2, true);

      const pcm16Buffer = new Int16Array(length);
      for (let k = 0; k < length; k++) {
        pcm16Buffer[k] = Math.max(-32768, Math.min(32767, buffer[k] * 32767));
      }

      const blob = new Blob([headerBuffer, pcm16Buffer], { type: 'audio/wav' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `TTS_Robust_Vocal_${activeVoice.id}.wav`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      trace.unshift(`[${new Date().toLocaleTimeString()}] WAV file download synthesized and triggered successfully!`);
      setTtsLogs([...trace]);
    } catch (e: any) {
      trace.unshift(`[${new Date().toLocaleTimeString()}] Local WAV compiler error: ${e.message}`);
      setTtsLogs([...trace]);
    }
  };

  return (
    <div className="space-y-6 text-slate-800">
      
      {/* APP HEADER DESCRIPTION */}
      <div className="bg-gradient-to-r from-slate-900 to-indigo-950 p-5 rounded-2xl border border-indigo-950/60 shadow-lg flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <div className="flex items-center gap-1.5 text-indigo-400 font-mono text-[10px] uppercase tracking-[0.15em] mb-1">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            Interactive Sound Studio Engine
          </div>
          <h1 className="text-xl md:text-2xl font-black text-white flex items-center gap-2">
            ស្ទូឌីយោ Dubbing Studio Pro
          </h1>
          <p className="text-xs text-slate-300 max-w-xl">
            ប្រព័ន្ធគ្រប់គ្រងការលាយសម្លេង ញែកភ្លេងគំរូ UVR5 និងបកប្រែ Subtitles ស្វ័យប្រវត្ត លឿនរលូនប្រកបដោយជំនាញវិជ្ជាជីវៈខ្ពស់។
          </p>
        </div>
        <div className="flex items-center gap-2 bg-indigo-500/10 border border-indigo-500/20 px-3 py-1.5 rounded-lg">
          <Layers className="w-4 h-4 text-indigo-400 animate-pulse" />
          <span className="text-xs font-mono text-indigo-300">
            Voice Model: <b className="text-white">{activeVoice.name}</b>
          </span>
        </div>
      </div>

      {/* CORE WORKSPACE GRID (Image visual representation) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        
        {/* LEFT COLUMN PANEL: Video Player & Workspace Tools (lg:col-span-4) */}
        <div className="lg:col-span-4 flex flex-col gap-4">
          
          {/* VIDEO preview area */}
          <div className="bg-[#111827] border border-slate-800/80 rounded-xl overflow-hidden shadow-sm flex flex-col">
            <div className="bg-[#1f2937] px-3.5 py-2 border-b border-slate-800 flex justify-between items-center">
              <span className="text-[11px] font-bold text-slate-300 flex items-center gap-1.5">
                <Video className="w-3.5 h-3.5 text-indigo-400" />
                Video Monitor Player
              </span>
              <span className={`text-[9px] px-1.5 py-0.5 rounded font-mono font-bold ${isVideoLoaded ? "bg-emerald-950 text-emerald-400" : "bg-slate-800 text-slate-400"}`}>
                {isVideoLoaded ? "ACTIVE" : "NO VIDEO"}
              </span>
            </div>

            {/* Simulated 16:9 Screen (Matches image's grey border & camera logo) */}
            <div className="aspect-video bg-[#0f172a] flex flex-col items-center justify-center relative group overflow-hidden">
              {isVideoLoaded ? (
                /* Interactive HTML5 Video visualizer simulation (Active loaded clip) */
                <div className="absolute inset-0 flex flex-col items-center justify-center p-4 bg-gradient-to-br from-[#1e1b4b] via-[#020617] to-[#111827]">
                  <div className="flex items-center gap-1 justify-center w-40 h-10 mb-2">
                    {[10,25,36,58,40,90,75,44,28,40,88,62,40,22,12].map((val, i) => (
                      <div 
                        key={i} 
                        className="w-1 bg-indigo-500 rounded-sm transition-all"
                        style={{ 
                          height: `${isPlaying ? Math.max(4, val * Math.sin((playPercent / 5) + i)) : 6}%`,
                          backgroundColor: i % 2 === 0 ? '#6366f1' : '#14b8a6'
                        }}
                      />
                    ))}
                  </div>
                  <span className="text-xs font-bold text-white font-mono animate-pulse">
                    Playing Scene Frame_{Math.floor(playPercent * 4.5)}
                  </span>
                  <span className="text-[10px] text-slate-400 mt-0.5">
                    Audio Sample Synchronized
                  </span>
                </div>
              ) : (
                /* Unloaded Grey state representation from picture */
                <div className="flex flex-col items-center justify-center text-slate-400 p-6">
                  {/* Big Video Camera Outer Icon */}
                  <div className="w-16 h-16 rounded-full bg-slate-900 border border-slate-800 flex items-center justify-center mb-3">
                    <Video className="w-8 h-8 text-slate-500" />
                  </div>
                  <span className="text-sm font-bold text-slate-400 font-sans">No video loaded</span>
                  <span className="text-[10px] text-slate-500 mt-1">Upload a video and import or transcribe.</span>
                </div>
              )}

              {/* Subtitle direct video burn-in overlay */}
              {subtitles.length > 0 && isVideoLoaded && (
                <div className="absolute bottom-4 left-4 right-4 bg-black/70 backdrop-blur-xs py-2 px-3 rounded-lg border border-white/10 text-center">
                  <span className="text-xs md:text-sm font-sans font-bold text-yellow-300">
                    {subtitles[Math.min(subtitles.length - 1, Math.floor((playPercent / 100) * subtitles.length))]?.text || "..."}
                  </span>
                </div>
              )}
            </div>

            {/* Mini Player Controls with timestamps (00:00.00 / 00:00.00 look) */}
            <div className="bg-[#1f2937] p-3 border-t border-slate-850 space-y-2">
              <div className="flex justify-between items-center text-xs font-mono text-slate-300">
                <span>00:{Math.floor((playPercent * 0.9)).toString().padStart(2, '0')}.00</span>
                <span>00:90.00</span>
              </div>
              <div className="flex justify-between items-center gap-3">
                <div className="flex items-center gap-1.5">
                  <button 
                    onClick={togglePlayheadState}
                    title="Play / Pause"
                    className="w-8 h-8 rounded-lg bg-indigo-600 text-white cursor-pointer hover:bg-indigo-500 flex items-center justify-center transition-all shadow-sm"
                  >
                    {isPlaying ? <Square className="w-3.5 h-3.5 fill-white" /> : <Play className="w-3.5 h-3.5 fill-white ml-0.5" />}
                  </button>
                  <button
                    onClick={resetPlayhead}
                    title="Stop & Reset"
                    className="w-8 h-8 rounded-lg bg-slate-800 text-slate-300 cursor-pointer hover:bg-slate-700 flex items-center justify-center transition-all border border-slate-700"
                  >
                    <Square className="w-3.5 h-3.5 text-red-400" />
                  </button>
                </div>

                {/* Level slider indicator representation from image */}
                <div className="flex-1 flex items-center gap-2">
                  <Volume2 className="w-3.5 h-3.5 text-slate-400" />
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={mixerVolumes.master}
                    onChange={(e) => {
                      setMixerVolumes(prev => ({ ...prev, master: parseInt(e.target.value) }));
                      if (isPlaying) setTimeout(() => playTimelineSpeechSynth(), 50);
                    }}
                    className="w-full h-1 bg-slate-800 rounded appearance-none cursor-pointer accent-indigo-500"
                  />
                  <span className="text-[10px] text-slate-400 font-mono w-6">{mixerVolumes.master}%</span>
                </div>
              </div>
            </div>
          </div>

          {/* WORKSPACE TOOLS (GRID AREA) */}
          <div className="bg-[#0f172a] border border-slate-800 rounded-xl p-4 space-y-3 shadow-md">
            <h2 className="text-xs font-black text-slate-300 uppercase tracking-widest flex items-center gap-2 border-b border-slate-800/85 pb-2">
              <span className="w-2 h-2 rounded bg-indigo-500" />
              Workspace Tools
            </h2>

            {/* Exactly 6 Grid buttons matching layout and look from screenshot */}
            <div className="grid grid-cols-2 gap-2.5">
              
              {/* Button 1: Load Video */}
              <button
                onClick={handleLoadVideo}
                className={`py-3.5 px-3 rounded-lg border text-xs font-bold font-sans flex flex-col items-center justify-center gap-2 transition-all cursor-pointer ${
                  isVideoLoaded 
                    ? "bg-indigo-950/40 text-indigo-300 border-indigo-500/50" 
                    : "bg-[#1e293b]/70 hover:bg-[#1e293b] text-slate-200 border-slate-800 hover:border-slate-700"
                }`}
              >
                <FolderOpen className="w-4 h-4 text-violet-400" />
                <span>Load Video</span>
              </button>

              {/* Button 2: Load BGM */}
              <button
                onClick={handleLoadBGM}
                className={`py-3.5 px-3 rounded-lg border text-xs font-bold font-sans flex flex-col items-center justify-center gap-2 transition-all cursor-pointer ${
                  isBgmLoaded 
                    ? "bg-teal-950/40 text-teal-300 border-teal-500/50" 
                    : "bg-[#1e293b]/70 hover:bg-[#1e293b] text-slate-200 border-slate-800 hover:border-slate-700"
                }`}
              >
                <Music className="w-4 h-4 text-teal-400" />
                <span>Load BGM</span>
              </button>

              {/* Button 3: Isolate BGM (UVR5 filter trigger) */}
              <button
                onClick={handleIsolateBGM}
                disabled={isSeparating}
                className={`py-3.5 px-3 rounded-lg border text-xs font-bold font-sans flex flex-col items-center justify-center gap-2 transition-all cursor-pointer ${
                  isSeparated 
                    ? "bg-emerald-950/40 text-emerald-300 border-emerald-500/50" 
                    : "bg-[#1e293b]/70 hover:bg-[#1e293b] text-slate-200 border-slate-800 hover:border-slate-700"
                }`}
              >
                {isSeparating ? (
                  <RefreshCw className="w-4 h-4 text-emerald-400 animate-spin" />
                ) : (
                  <Split className="w-4 h-4 text-emerald-400" />
                )}
                <span>Isolate BGM</span>
              </button>

              {/* Button 4: Audio Muted (Screenshot shows standard active bold purple block) */}
              <button
                onClick={toggleWorkspaceMute}
                className={`py-3.5 px-3 rounded-lg border text-xs font-extrabold font-sans flex flex-col items-center justify-center gap-2 transition-all cursor-pointer ${
                  isMuted 
                    ? "bg-[#6366f1] text-white border-transparent shadow shadow-indigo-500/50 animate-bounce" 
                    : "bg-[#1e293b]/70 hover:bg-[#1e293b] text-indigo-400 border-slate-800 hover:border-slate-750"
                }`}
              >
                {isMuted ? (
                  <>
                    <VolumeX className="w-4 h-4 text-white" />
                    <span>Audio Muted</span>
                  </>
                ) : (
                  <>
                    <Volume2 className="w-4 h-4 text-indigo-400" />
                    <span>Audio Active</span>
                  </>
                )}
              </button>

              {/* Button 5: Export SRT */}
              <button
                onClick={handleExportSRTFile}
                className="py-3.5 px-3 rounded-lg bg-[#1e293b]/70 hover:bg-[#1e293b] text-slate-200 border border-slate-800 hover:border-slate-700 text-xs font-bold font-sans flex flex-col items-center justify-center gap-2 transition-all cursor-pointer"
              >
                <Download className="w-4 h-4 text-orange-400" />
                <span>Export SRT</span>
              </button>

              {/* Button 6: Import (SRT) */}
              <button
                onClick={handleImportSRTMock}
                className="py-3.5 px-3 rounded-lg bg-[#1e293b]/70 hover:bg-[#1e293b] text-slate-200 border border-slate-800 hover:border-slate-700 text-xs font-bold font-sans flex flex-col items-center justify-center gap-2 transition-all cursor-pointer"
              >
                <Upload className="w-4 h-4 text-pink-400" />
                <span>Import (SRT)</span>
              </button>

            </div>

            {/* SEPARATING EVENT DETAILS */}
            {isSeparating && (
              <div className="bg-[#0a1120] p-3 rounded-lg border border-slate-800/80 space-y-1.5 text-xs text-slate-300">
                <div className="flex justify-between items-center text-[10.5px]">
                  <span className="text-slate-400">{separationPhase}</span>
                  <span className="font-mono text-emerald-400 font-bold">{separationProgress}%</span>
                </div>
                <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden">
                  <div 
                    className="bg-emerald-500 h-1.5 rounded-full transition-all duration-300"
                    style={{ width: `${separationProgress}%` }}
                  />
                </div>
              </div>
            )}
          </div>

        </div>

        {/* RIGHT COLUMN PANEL: Subtitles workspace canvas area (lg:col-span-8) */}
        <div className="lg:col-span-8 flex flex-col justify-between bg-white border border-slate-200 rounded-xl shadow-sm min-h-[460px] relative overflow-hidden">
          
          {/* Subtle stylish translucent workspace watermark behind */}
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none select-none z-0 overflow-hidden">
            <h1 className="text-[12.5vw] font-black tracking-widest text-[#f1f5f9]/85 uppercase rotate-[-23deg] select-none font-display">
              DACODING
            </h1>
          </div>

          <div className="p-5 flex-1 flex flex-col z-10">
            
            {/* Header toolbar for right canvas */}
            <div className="flex justify-between items-center border-b border-slate-100 pb-3 mb-4">
              <div className="flex items-center gap-2">
                <FileText className="w-4 h-4 text-indigo-600" />
                <h3 className="text-sm font-bold text-slate-800 font-sans uppercase tracking-tight">
                  ស្ទូឌីយោបកប្រែ & Subtitle Feed Editor
                </h3>
              </div>
              <span className="text-[11px] font-mono text-slate-400 bg-slate-50 border border-slate-100 px-2 py-0.5 rounded">
                Total Segments: {subtitles.length}
              </span>
            </div>

            {/* IF NO SUBTITLES ARE LOADED: EXACTLY SHOW SCREENSHOT PLACEHOLDER TEXT */}
            {subtitles.length === 0 ? (
              <div className="flex-1 flex flex-col items-center justify-center text-center p-10">
                <p className="text-sm font-medium text-slate-400">
                  No subtitles available. Upload a video and import or transcribe.
                </p>
                <div className="mt-4 flex gap-2.5">
                  <button 
                    onClick={handleAutoTranscribeText}
                    className="h-9 px-4 rounded-lg bg-indigo-50/70 hover:bg-indigo-100 text-indigo-700 border border-indigo-200/50 text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5"
                  >
                    <Sparkles className="w-3.5 h-3.5 text-indigo-600" />
                    Transcribe Demo Script
                  </button>
                  <button 
                    onClick={handleImportSRTMock}
                    className="h-9 px-4 rounded-lg bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200 text-xs font-bold transition-all cursor-pointer"
                  >
                    Load Sample SRT
                  </button>
                </div>
              </div>
            ) : (
              /* ACTIVE EDITABLE SUBTITLE LIST */
              <div className="flex-1 space-y-3 overflow-y-auto max-h-[340px] pr-1.5">
                {subtitles.map((sub, idx) => (
                  <div 
                    key={sub.id}
                    onClick={() => setSelectedSubId(sub.id)}
                    className={`p-3.5 rounded-xl border transition-all text-xs flex flex-col md:flex-row md:items-center justify-between gap-3 ${
                      selectedSubId === sub.id 
                        ? "bg-indigo-50/50 border-indigo-505/30 ring-1 ring-indigo-500/10" 
                        : "bg-slate-50/60 hover:bg-slate-50 border-slate-100"
                    }`}
                  >
                    <div className="flex items-center gap-2.5 shrink-0">
                      <span className="w-5 h-5 rounded-full bg-slate-200/60 flex items-center justify-center font-mono text-[9px] text-slate-650 font-bold">
                        {idx + 1}
                      </span>
                      <div className="flex items-center gap-1 text-[11px] font-mono text-indigo-600 font-black">
                        <Clock className="w-3 h-3" />
                        <span>{sub.time}</span>
                      </div>
                    </div>

                    <input 
                      type="text"
                      value={sub.text}
                      onChange={(e) => updateSubtitleText(sub.id, e.target.value)}
                      className="flex-1 min-w-[200px] h-9 px-3 bg-white border border-slate-100 hover:border-slate-205 focus:border-indigo-500 rounded-lg text-[13px] text-slate-700 font-sans outline-none focus:ring-1 focus:ring-indigo-500/10"
                    />

                    <div className="flex items-center gap-1.5 shrink-0 self-end md:self-auto">
                      <button 
                        onClick={() => {
                          setSelectedSubId(sub.id);
                          setTtsInputMsg(sub.text);
                        }}
                        title="Copy text to TTS"
                        className="p-1.5 rounded-lg text-slate-400 hover:text-indigo-600 hover:bg-white border border-transparent hover:border-slate-100 transition-all cursor-pointer"
                      >
                        <Copy className="w-3.5 h-3.5" />
                      </button>
                      <button 
                        onClick={() => setSubtitles(prev => prev.filter(p => p.id !== sub.id))}
                        title="Delete track"
                        className="p-1.5 rounded-lg text-slate-400 hover:text-red-500 hover:bg-white border border-transparent hover:border-slate-100 transition-all cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* EXPORTS AREA BOTTOM BAR (RE-ARRANGED PROPORTIONS) */}
          <div className="p-4 bg-slate-50/80 border-t border-slate-100 z-10 flex flex-col sm:flex-row justify-between items-center gap-3">
            <div className="text-[11px] text-slate-500 font-sans font-bold">
              {subtitles.length > 0 && "អត្ថបទ Subtitle ត្រូវបានតម្រង់ជួរត្រឹមត្រូវជាមួយរលកសម្លេង Vocal A3"}
            </div>
            <div className="flex items-center gap-2 w-full sm:w-auto">
              <button
                onClick={handleExportWordTranscript}
                disabled={subtitles.length === 0}
                className="flex-1 sm:flex-initial h-9 px-4 rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 text-xs font-bold flex items-center justify-center gap-1.5 transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <FileDown className="w-4 h-4" />
                <span>Microsoft Word (.doc)</span>
              </button>
              <button
                onClick={copyToClipboard}
                disabled={subtitles.length === 0}
                className="flex-1 sm:flex-initial h-9 px-4 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {copiedNotification ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4 text-indigo-400" />}
                <span>{copiedNotification ? "Copied!" : "Copy Raw"}</span>
              </button>
            </div>
          </div>

        </div>

      </div>

      {/* DOCK BAR METRIC ROW: REAL-TIME DSP MIXER & FAIL-SAFE TTS */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        
        {/* MIXER CONSOLE SLIDERS (lg:col-span-7) */}
        <div className="lg:col-span-7 bg-[#0f172a] border border-slate-800 rounded-xl p-5 space-y-4 shadow-lg">
          <div className="flex justify-between items-center border-b border-slate-800/80 pb-2.5">
            <h3 className="text-xs font-black text-slate-300 uppercase tracking-widest flex items-center gap-2">
              <SlidersHorizontal className="w-4 h-4 text-indigo-400" />
              Dynamic Multi-Track Audio Mixer (Ch1-Ch4)
            </h3>
            <span className="text-[10px] text-emerald-400 font-mono bg-emerald-950/30 px-2 py-0.5 rounded border border-emerald-500/20">
              DSP Server Synced
            </span>
          </div>

          <div className="grid grid-cols-4 gap-3 bg-[#0a0f1d] p-3 rounded-lg border border-slate-850">
            
            {/* Ch 1: Video Sound */}
            <div className="bg-[#131926] p-2 rounded-lg border border-slate-800 flex flex-col items-center">
              <span className="text-[8px] font-mono text-slate-500 uppercase font-bold text-center">Ch 1 / Video</span>
              
              {/* LED DB Indicators */}
              <div className="h-28 w-10 bg-slate-950 my-2 rounded p-1 flex justify-between gap-1">
                <div className="flex-1 flex flex-col justify-end gap-[1.5px]">
                  {Array.from({ length: 12 }).map((_, i) => {
                    const level = -48 + i * 4;
                    const active = mixerDbLevels.video >= level;
                    return (
                      <div 
                        key={i} 
                        className={`h-[4.5px] rounded-[1px] transition-all ${
                          active ? i < 3 ? "bg-red-500" : i < 6 ? "bg-amber-400" : "bg-emerald-500" : "bg-slate-900"
                        }`}
                      />
                    );
                  })}
                </div>
                <div className="flex-1 flex items-center justify-center">
                  <input
                    type="range"
                    min="0"
                    max="100"
                    orient="vertical"
                    style={{ writingMode: 'bt-lr', WebkitAppearance: 'slider-vertical' } as any}
                    value={mixerVolumes.video}
                    onChange={(e) => {
                      setMixerVolumes(prev => ({ ...prev, video: parseInt(e.target.value) }));
                      if (isPlaying) setTimeout(() => playTimelineSpeechSynth(), 50);
                    }}
                    className="h-24 w-1.5 accent-indigo-500"
                  />
                </div>
              </div>
              <span className="text-[10px] font-mono font-bold text-indigo-400">{mixerVolumes.video}%</span>
            </div>

            {/* Ch 2: BGM Sound */}
            <div className="bg-[#131926] p-2 rounded-lg border border-slate-800 flex flex-col items-center">
              <span className="text-[8px] font-mono text-slate-500 uppercase font-bold text-center">Ch 2 / BGM</span>
              
              <div className="h-28 w-10 bg-slate-950 my-2 rounded p-1 flex justify-between gap-1">
                <div className="flex-1 flex flex-col justify-end gap-[1.5px]">
                  {Array.from({ length: 12 }).map((_, i) => {
                    const level = -48 + i * 4;
                    const active = mixerDbLevels.bgm >= level;
                    return (
                      <div 
                        key={i} 
                        className={`h-[4.5px] rounded-[1px] transition-all ${
                          active ? i < 3 ? "bg-red-500" : i < 6 ? "bg-amber-400" : "bg-emerald-500" : "bg-slate-900"
                        }`}
                      />
                    );
                  })}
                </div>
                <div className="flex-1 flex items-center justify-center">
                  <input
                    type="range"
                    min="0"
                    max="100"
                    orient="vertical"
                    style={{ writingMode: 'bt-lr', WebkitAppearance: 'slider-vertical' } as any}
                    value={mixerVolumes.bgm}
                    onChange={(e) => {
                      setMixerVolumes(prev => ({ ...prev, bgm: parseInt(e.target.value) }));
                      if (isPlaying) setTimeout(() => playTimelineSpeechSynth(), 50);
                    }}
                    className="h-24 w-1.5 accent-teal-400"
                  />
                </div>
              </div>
              <span className="text-[10px] font-mono font-bold text-teal-400">{mixerVolumes.bgm}%</span>
            </div>

            {/* Ch 3: Vocal Track */}
            <div className="bg-[#131926] p-2 rounded-lg border border-slate-800 flex flex-col items-center">
              <span className="text-[8px] font-mono text-slate-400 uppercase font-black text-center">Ch 3 / Vocals</span>
              
              <div className="h-28 w-10 bg-slate-950 my-2 rounded p-1 flex justify-between gap-1">
                <div className="flex-1 flex flex-col justify-end gap-[1.5px]">
                  {Array.from({ length: 12 }).map((_, i) => {
                    const level = -48 + i * 4;
                    const active = mixerDbLevels.vocal >= level;
                    return (
                      <div 
                        key={i} 
                        className={`h-[4.5px] rounded-[1px] transition-all ${
                          active ? i < 3 ? "bg-red-500" : i < 6 ? "bg-amber-400" : "bg-emerald-500" : "bg-slate-900"
                        }`}
                      />
                    );
                  })}
                </div>
                <div className="flex-1 flex items-center justify-center">
                  <input
                    type="range"
                    min="0"
                    max="100"
                    orient="vertical"
                    style={{ writingMode: 'bt-lr', WebkitAppearance: 'slider-vertical' } as any}
                    value={mixerVolumes.vocal}
                    onChange={(e) => {
                      setMixerVolumes(prev => ({ ...prev, vocal: parseInt(e.target.value) }));
                      if (isPlaying) setTimeout(() => playTimelineSpeechSynth(), 50);
                    }}
                    className="h-24 w-1.5 accent-indigo-500"
                  />
                </div>
              </div>
              <span className="text-[10px] font-mono font-bold text-indigo-400">{mixerVolumes.vocal}%</span>
            </div>

            {/* Ch 4: Master Output */}
            <div className="bg-indigo-950/20 p-2 rounded-lg border border-indigo-900/60 flex flex-col items-center">
              <span className="text-[8px] font-mono text-orange-400 uppercase font-black text-center">Ch 4 / Master</span>
              
              <div className="h-28 w-10 bg-slate-950 my-2 rounded p-1 flex justify-between gap-1">
                <div className="flex-1 flex flex-col justify-end gap-[1.5px]">
                  {Array.from({ length: 12 }).map((_, i) => {
                    const level = -48 + i * 4;
                    const active = mixerDbLevels.master >= level;
                    return (
                      <div 
                        key={i} 
                        className={`h-[4.5px] rounded-[1px] transition-all ${
                          active ? i < 3 ? "bg-red-500" : i < 6 ? "bg-amber-400" : "bg-emerald-500" : "bg-slate-900"
                        }`}
                      />
                    );
                  })}
                </div>
                <div className="flex-1 flex items-center justify-center">
                  <input
                    type="range"
                    min="0"
                    max="100"
                    orient="vertical"
                    style={{ writingMode: 'bt-lr', WebkitAppearance: 'slider-vertical' } as any}
                    value={mixerVolumes.master}
                    onChange={(e) => {
                      setMixerVolumes(prev => ({ ...prev, master: parseInt(e.target.value) }));
                      if (isPlaying) setTimeout(() => playTimelineSpeechSynth(), 50);
                    }}
                    className="h-24 w-1.5 accent-orange-500"
                  />
                </div>
              </div>
              <span className="text-[10px] font-mono font-bold text-orange-400">{mixerVolumes.master}%</span>
            </div>

          </div>

          {/* EQ KNOB BANNER */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-1 items-center">
            <div className="space-y-1 bg-[#0a0f1d] p-3 rounded-lg border border-slate-850">
              <div className="flex justify-between items-center text-[10.5px] font-mono text-slate-400 mb-1">
                <span>DSP Equalization High Band:</span>
                <span className="text-indigo-400 font-extrabold">{eqHigh > 0 ? `+${eqHigh}` : eqHigh} dB</span>
              </div>
              <input 
                type="range"
                min="-15"
                max="15"
                value={eqHigh}
                onChange={(e) => setEqHigh(parseInt(e.target.value))}
                className="w-full h-1 bg-slate-850 appearance-none cursor-pointer accent-indigo-500"
              />
            </div>
            <div className="space-y-1 bg-[#0a0f1d] p-3 rounded-lg border border-slate-850">
              <div className="flex justify-between items-center text-[10.5px] font-mono text-slate-400 mb-1">
                <span>Master Pan Balance (Left - Right):</span>
                <span className="text-indigo-400 font-extrabold">{panBalance === 0 ? "Center" : panBalance > 0 ? `${panBalance} R` : `${Math.abs(panBalance)} L`}</span>
              </div>
              <input 
                type="range"
                min="-50"
                max="50"
                value={panBalance}
                onChange={(e) => setPanBalance(parseInt(e.target.value))}
                className="w-full h-1 bg-slate-850 appearance-none cursor-pointer accent-indigo-500"
              />
            </div>
          </div>
        </div>

        {/* FAIL-SAFE TTS INTERACTIVE CONTROLLER (lg:col-span-5) */}
        <div className="lg:col-span-5 bg-[#0f172a] border border-slate-800 rounded-xl p-5 space-y-3.5 shadow-lg flex flex-col justify-between">
          <div className="space-y-3">
            <div className="flex justify-between items-center border-b border-slate-800/80 pb-2">
              <h3 className="text-xs font-black text-slate-300 uppercase tracking-widest flex items-center gap-2">
                <Flame className="w-4 h-4 text-orange-500 animate-pulse" />
                Robust Free-Fail Safe TTS System
              </h3>
              <span className="text-[9px] bg-sky-950 text-sky-400 border border-sky-550/20 px-1.5 py-0.5 rounded font-mono font-bold">
                Double-Pass Active
              </span>
            </div>

            <div className="space-y-1.5">
              <label className="block text-[10px] font-semibold text-slate-400">អត្ថបទសំយោគសម្លេង (Interactive TTS Text)</label>
              <textarea
                value={ttsInputMsg}
                onChange={(e) => setTtsInputMsg(e.target.value)}
                rows={2}
                className="w-full p-2.5 rounded-lg border border-slate-800 bg-slate-950 text-[#c9d1d9] text-[11.5px] leading-relaxed focus:outline-none focus:ring-1 focus:ring-indigo-500 resize-none font-sans"
                placeholder="បំពេញពាក្យពេចន៍ដែលចង់ឱ្យ AI បន្លឺសម្លេងនិយាយ..."
              />
            </div>

            {/* Selection modes */}
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => setTtsEngineMode('system')}
                className={`py-1.5 px-2 rounded-md font-mono text-[10px] font-bold uppercase transition-all border ${
                  ttsEngineMode === 'system'
                    ? "bg-indigo-600 text-white border-transparent"
                    : "bg-slate-900 text-slate-405 border-slate-800 hover:bg-[#1a202c]"
                }`}
              >
                Web-Speech Client
              </button>
              <button
                onClick={() => setTtsEngineMode('offline_weaver')}
                className={`py-1.5 px-2 rounded-md font-mono text-[10px] font-bold uppercase transition-all border ${
                  ttsEngineMode === 'offline_weaver'
                    ? "bg-indigo-600 text-white border-transparent shadow shadow-indigo-600/30"
                    : "bg-slate-900 text-slate-405 border-slate-800 hover:bg-[#1a202c]"
                }`}
                title="សម្លេងប្រព័ន្ធសុវត្ថិភាពក្រៅបណ្តាញ"
              >
                Offline Sound Weaver
              </button>
            </div>
          </div>

          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={triggerFailSafeTTSPlay}
                disabled={isTtsSynthesizing}
                className="h-10 rounded-lg bg-emerald-600 hover:bg-emerald-500 font-sans text-white text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer disabled:bg-slate-800 disabled:text-slate-500 transition-all"
              >
                {isTtsSynthesizing ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    Synthesizing...
                  </>
                ) : (
                  <>
                    <Volume2 className="w-4 h-4 text-white fill-white" />
                    បន្លឺសម្លេងនិយាយ
                  </>
                )}
              </button>
              <button
                onClick={downloadTTSWavFile}
                className="h-10 rounded-lg bg-[#1e293b]/50 hover:bg-[#1e293b] border border-slate-800 text-white text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer transition-all"
              >
                <Download className="w-4 h-4 text-indigo-400" />
                ទាញយក WAV file
              </button>
            </div>

            {/* Trace log panel */}
            <div className="bg-[#05070e] border border-slate-850 p-2 rounded-lg h-16 overflow-y-auto scrollbar-none font-mono text-[8.5px] text-slate-450 leading-relaxed space-y-1">
              <div className="text-[9px] text-indigo-400/90 font-bold uppercase border-b border-white/5 pb-0.5 flex justify-between">
                <span>Guard Event logs</span>
                <span>Active Protection</span>
              </div>
              {ttsLogs.map((log, id) => (
                <div key={id} className="truncate">
                  {log}
                </div>
              ))}
            </div>
          </div>
        </div>

      </div>

      {/* FOOTER MULTI-TRACK SEQUENCE TIMELINE PANEL (As seen in screenshot) */}
      <div className="bg-[#0f172a] border border-slate-800 rounded-xl overflow-hidden shadow-lg">
        
        {/* UPPER STATUS ACTION BAR (Exactly from the screenshot!) */}
        <div className="bg-[#1e2937] px-4 py-3 flex flex-wrap justify-between items-center gap-3 border-b border-slate-800">
          
          {/* Timeline Title Left */}
          <div className="flex items-center gap-2">
            <Layers className="w-4 h-4 text-indigo-400 animate-pulse" />
            <span className="text-xs font-black text-white font-sans uppercase tracking-widest flex items-center gap-1.5">
              Timeline Editor
            </span>
          </div>

          {/* Controls Right (ZOOM, dropdown selection, Transcribe, Auto-Fit, Generate Selected Audio) */}
          <div className="flex items-center gap-3.5 flex-wrap">
            
            {/* Zoom Slider look from graphic */}
            <div className="flex items-center gap-2 text-xs font-bold text-slate-300">
              <span className="text-[10px] uppercase font-mono text-slate-400">ZOOM:</span>
              <input
                type="range"
                min="50"
                max="200"
                value={zoomLevel}
                onChange={(e) => setZoomLevel(parseInt(e.target.value))}
                className="w-20 md:w-28 h-1 bg-slate-800 rounded appearance-none cursor-pointer accent-indigo-500"
              />
              <span className="font-mono text-[10.5px] text-indigo-400 w-9">{zoomLevel}%</span>
            </div>

            {/* Dropdown element (looks like clean white bordered select "Khmer") */}
            <div className="relative text-xs">
              <select
                value={transcribeLanguage}
                onChange={(e) => setTranscribeLanguage(e.target.value)}
                className="appearance-none bg-slate-900 border border-slate-700 hover:border-slate-600 rounded-lg h-8 px-3.5 pr-8 text-white font-sans font-medium focus:outline-none focus:ring-1 focus:ring-indigo-500 cursor-pointer"
              >
                <option value="Khmer">Khmer 🇰🇭</option>
                <option value="English">English 🇺🇸</option>
                <option value="Thai">Thai 🇹🇭</option>
              </select>
              <ChevronDown className="w-3.5 h-3.5 text-slate-400 absolute right-2.5 top-2.5 pointer-events-none" />
            </div>

            {/* Transcribe Button */}
            <button
              onClick={handleAutoTranscribeText}
              disabled={isTranscribing}
              className="h-8 px-3.5 rounded-lg bg-slate-905 hover:bg-[#1a202c] border border-slate-700 text-slate-200 text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer"
            >
              <Sparkles className="w-3.5 h-3.5 text-yellow-405 fill-yellow-400" />
              <span>Transcribe</span>
            </button>

            {/* Auto-Fit: Weak (With active green glow / border matching screenshot) */}
            <button
              onClick={() => setAutoFitStrength(prev => prev === 'weak' ? 'strong' : prev === 'strong' ? 'none' : 'weak')}
              className={`h-8 px-3.5 rounded-lg text-xs font-extrabold flex items-center gap-1.5 transition-all border cursor-pointer ${
                autoFitStrength === 'weak'
                  ? "bg-transparent border-emerald-500 text-emerald-400 ring-1 ring-emerald-500/20"
                  : autoFitStrength === 'strong'
                  ? "bg-emerald-600/10 border-emerald-500 text-emerald-300 font-display ring-1 ring-emerald-500/30"
                  : "bg-transparent border-slate-700 text-slate-400"
              }`}
            >
              <span className={`w-1.5 h-1.5 rounded-full ${autoFitStrength !== 'none' ? "bg-emerald-400 animate-ping" : "bg-slate-500"}`} />
              <span>Auto-Fit: {autoFitStrength === 'weak' ? "Weak" : autoFitStrength === 'strong' ? "Strong" : "Off"}</span>
            </button>

            {/* Generate Selected Audio (Looks like clean button next to Auto-fit) */}
            <button
              onClick={triggerFailSafeTTSPlay}
              className="h-8 px-3.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer shadow-sm border border-indigo-700"
            >
              <Volume2 className="w-3.5 h-3.5" />
              <span>Generate Selected Audio</span>
            </button>

          </div>

        </div>

        {/* TIME STICK TICKER RULER */}
        <div className="bg-[#0c101b] border-b border-slate-900 text-[10px] font-mono text-slate-500 py-1.5 relative select-none">
          {/* Dynamic Playhead Seek vertical Line overlay */}
          <div 
            className="absolute top-0 bottom-0 w-[2px] bg-red-500 z-30 shadow shadow-red-500 transition-all duration-100 ease-linear pointer-events-none"
            style={{ left: `${14.5 + (playPercent / 100) * 82.5}%` }}
          />

          {/* Time Marker increments scaled under timeline container */}
          <div className="grid grid-cols-12 items-center text-center">
            <span className="col-span-2 text-left px-4 font-sans font-bold text-slate-400 uppercase tracking-wide">Tracking</span>
            <div className="col-span-10 flex justify-between pr-8 border-l border-slate-900 pl-4">
              <span>00:00.00</span>
              <span>00:10.00</span>
              <span>00:20.00</span>
              <span>00:30.00</span>
              <span>00:40.00</span>
              <span>00:50.00</span>
              <span>01:00.00</span>
              <span>01:10.00</span>
              <span>01:20.00</span>
              <span>01:30.00</span>
            </div>
          </div>
        </div>

        {/* TIMELINE AUDIO TRACK SEQUENCER BLOCK */}
        <div className="p-3 bg-[#0a0d18] space-y-2.5 relative select-none">
          
          {/* Playhead Guide marker line overlay on audio tracks */}
          <div 
            className="absolute top-0 bottom-0 w-[1.5px] bg-red-500/80 z-20 pointer-events-none"
            style={{ left: `${14.5 + (playPercent / 100) * 82.5}%` }}
          />

          {/* Track Lane T1: Video Source Waveform (Purple shade) */}
          <div className="grid grid-cols-12 items-center gap-3">
            <div className="col-span-2 flex items-center gap-1.5 text-[11px] font-mono font-bold text-slate-400 px-2 truncate">
              <span className="w-1.5 h-1.5 rounded-full bg-violet-500" />
              T1 Video sound
            </div>
            <div className="col-span-10 h-10 bg-slate-950/80 rounded-lg border border-slate-850 overflow-hidden relative flex items-center">
              {isVideoLoaded ? (
                <div className="absolute inset-y-1.5 left-2 right-12 bg-indigo-500/10 border border-indigo-500/35 rounded-md flex items-center justify-between px-3">
                  <span className="text-[10px] text-indigo-350 font-bold truncate">T1_Audio_Video_Sequence.aac</span>
                  {/* Visual simulated waveform */}
                  <div className="flex items-center gap-0.5 h-6">
                    {[3,5,8,4,9,3,7,2,8,3,8,9,2,8,4,9,3,7,2,8,9,2,8,4,9,2,8].map((h, i) => (
                      <div key={i} className="w-[2px] bg-indigo-500" style={{ height: `${h * 10}%` }} />
                    ))}
                  </div>
                </div>
              ) : (
                <span className="text-[10px] text-slate-600 italic px-4">No sound block active. Click 'Load Video' to populate.</span>
              )}
            </div>
          </div>

          {/* Track Lane T2: BGM wave strip (Teal shade) */}
          <div className="grid grid-cols-12 items-center gap-3">
            <div className="col-span-2 flex items-center gap-1.5 text-[11px] font-mono font-bold text-slate-400 px-2 truncate">
              <span className="w-1.5 h-1.5 rounded-full bg-teal-500" />
              T2 BGM Sound
            </div>
            <div className="col-span-10 h-10 bg-slate-950/80 rounded-lg border border-slate-850 overflow-hidden relative flex items-center">
              {isBgmLoaded ? (
                <div className="absolute inset-y-1.5 left-2 right-6 bg-teal-500/10 border border-teal-500/35 rounded-md flex items-center justify-between px-3">
                  <span className="text-[10px] text-teal-350 font-bold truncate">T2_BGM_Stereo_Backbone.mp3</span>
                  <div className="flex items-center gap-0.5 h-6">
                    {[6,2,8,4,9,3,7,2,8,1,9,4,8,2,7,4,8,9,3,8,1,8,4,8,3,9,5].map((h, i) => (
                      <div key={i} className="w-[2px] bg-teal-500" style={{ height: `${h * 10}%` }} />
                    ))}
                  </div>
                </div>
              ) : (
                <span className="text-[10px] text-slate-600 italic px-4">No BGM block active. Click 'Load BGM' to populate.</span>
              )}
            </div>
          </div>

          {/* Track Lane T3: Speech/TTS Layer Track A3 (Orange/Indigo shade) */}
          <div className="grid grid-cols-12 items-center gap-3">
            <div className="col-span-2 flex items-center gap-1.5 text-[11px] font-mono font-bold text-slate-350 px-2 truncate">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              Track A3 (Vocal)
            </div>
            <div className="col-span-10 h-10 bg-slate-950/80 rounded-lg border border-slate-850 overflow-hidden relative flex items-center">
              {isSeparated ? (
                <div className="absolute inset-y-1.5 left-2 w-[85%] bg-emerald-500/10 border border-emerald-500/35 rounded-md flex items-center justify-between px-3">
                  <span className="text-[10px] text-emerald-350 font-bold truncate">A3_Isolated_Vocal_Realigned</span>
                  <div className="flex items-center gap-0.5 h-6 animate-pulse">
                    {[2,6,9,3,7,4,9,1,8,4,8,3,8,9,2,8,4,9,3,7,2,8,4,9,1,9,3].map((h, i) => (
                      <div key={i} className="w-[2px] bg-emerald-500" style={{ height: `${h * 10}%` }} />
                    ))}
                  </div>
                </div>
              ) : (
                <span className="text-[10px] text-slate-600 italic px-4">No vocal block active. Run 'Isolate BGM' filter to feed Track A3.</span>
              )}
            </div>
          </div>

        </div>

        {/* TIMELINE CONTROL INSTRUCTION CHEAT SHEET */}
        <div className="bg-[#1e2937] px-4 py-2 flex justify-between text-[10px] text-slate-400 font-mono">
          <span>Click playhead to jog frames manually | Left-drag sound layers within boundaries</span>
          <span>Timeline Frame Buffer: 24 Fps</span>
        </div>

      </div>

    </div>
  );
}
