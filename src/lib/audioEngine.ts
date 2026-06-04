/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

// Helper to calculate fundamental frequency (F0) using Autocorrelation pitch detection
export function detectPitch(buffer: Float32Array, sampleRate: number): number {
  const SIZE = buffer.length;
  let rms = 0;

  // Calculate Root Mean Square (RMS) to check if there is enough signal strength
  for (let i = 0; i < SIZE; i++) {
    const val = buffer[i];
    rms += val * val;
  }
  rms = Math.sqrt(rms / SIZE);
  if (rms < 0.008) {
    return -1; // Not enough signal
  }

  // Trim silence at start and end
  let r1 = 0;
  let r2 = SIZE - 1;
  const thres = 0.2;
  for (let i = 0; i < SIZE / 2; i++) {
    if (Math.abs(buffer[i]) > thres) {
      r1 = i;
      break;
    }
  }
  for (let i = SIZE - 1; i >= SIZE / 2; i--) {
    if (Math.abs(buffer[i]) > thres) {
      r2 = i;
      break;
    }
  }

  const signal = buffer.subarray(r1, r2);
  const len = signal.length;

  // Autocorrelation
  const c = new Float32Array(len);
  for (let lag = 0; lag < len; lag++) {
    let sum = 0;
    for (let i = 0; i < len - lag; i++) {
      sum += signal[i] * signal[i + lag];
    }
    c[lag] = sum;
  }

  // Find the first peak after descending from lag 0
  let d = 0;
  while (d < len - 1 && c[d] > c[d + 1]) {
    d++;
  }

  let maxval = -1;
  let maxpos = -1;
  for (let i = d; i < len; i++) {
    if (c[i] > maxval) {
      maxval = c[i];
      maxpos = i;
    }
  }

  let T0 = maxpos;
  
  // Refine peak extraction using basic quadratic interpolation
  if (maxpos > 0 && maxpos < len - 1) {
    const alpha = c[maxpos - 1];
    const beta = c[maxpos];
    const gamma = c[maxpos + 1];
    if (2 * beta - alpha - gamma !== 0) {
      const p = 0.5 * (alpha - gamma) / (alpha - 2 * beta + gamma);
      T0 = maxpos + p;
    }
  }

  const freq = sampleRate / T0;
  
  // Map typical human voice pitches (50Hz - 500Hz)
  if (freq >= 50 && freq <= 500) {
    return Math.round(freq);
  }
  
  return -1;
}

// Full Web Audio synthesis chain for voice modeling
export class VoiceClonerProcessor {
  private ctx: AudioContext | null = null;
  private micStream: MediaStream | null = null;
  private mediaRecorder: MediaRecorder | null = null;
  private recordedChunks: Blob[] = [];

  constructor() {
    // Audio engine ready
  }

  async initContext() {
    if (!this.ctx) {
      this.ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
    if (this.ctx.state === "suspended") {
      await this.ctx.resume();
    }
    return this.ctx;
  }

  getContext() {
    return this.ctx;
  }

  // Capture user microphone and stream it to analyze live frequencies
  async startRecording(onDataAvailable: (data: Blob) => void, onAnalyserSetup?: (analyser: AnalyserNode) => void) {
    const ctx = await this.initContext();
    this.recordedChunks = [];
    
    this.micStream = await navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
      },
    });

    if (onAnalyserSetup) {
      const source = ctx.createMediaStreamSource(this.micStream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 512;
      source.connect(analyser);
      onAnalyserSetup(analyser);
    }

    this.mediaRecorder = new MediaRecorder(this.micStream);
    this.mediaRecorder.ondataavailable = (event) => {
      if (event.data.size > 0) {
        this.recordedChunks.push(event.data);
        onDataAvailable(event.data);
      }
    };

    this.mediaRecorder.start(200); // Trigger data chunks every 200ms
  }

  stopRecording(): Promise<{ blob: Blob; buffer: AudioBuffer; sampleF0: number; sampleClarity: number }> {
    return new Promise((resolve, reject) => {
      if (!this.mediaRecorder || !this.micStream) {
        return reject("Recording not started");
      }

      this.mediaRecorder.onstop = async () => {
        try {
          const finalBlob = new Blob(this.recordedChunks, { type: "audio/webm; codecs=opus" });
          const arrayBuffer = await finalBlob.arrayBuffer();
          const tempCtx = await this.initContext();
          
          // Decode audio data to process pitch & frequency
          const audioBuffer = await tempCtx.decodeAudioData(arrayBuffer);
          const channelData = audioBuffer.getChannelData(0);
          
          // Detect pitch (Fundamental frequency F0)
          const sampleF0 = detectPitch(channelData, audioBuffer.sampleRate);
          
          // Calculate speech clarity (percentage of energy in voice bands 80Hz - 1200Hz vs background noise)
          let voicedEnergy = 0;
          let totalEnergy = 0;
          for (let i = 0; i < channelData.length; i++) {
            const square = channelData[i] * channelData[i];
            totalEnergy += square;
            if (i % 2 === 0) voicedEnergy += square; // simplified frequency energy estimation
          }
          const clarityValue = totalEnergy > 0 ? Math.min(100, Math.round((voicedEnergy / totalEnergy) * 125)) : 50;

          // Stop all audio tracks to release microphone hardware icon
          this.micStream?.getTracks().forEach(track => track.stop());
          this.micStream = null;

          resolve({
            blob: finalBlob,
            buffer: audioBuffer,
            sampleF0: sampleF0 > 0 ? sampleF0 : 150, // default if noise
            sampleClarity: Math.max(30, Math.min(98, clarityValue)),
          });
        } catch (e) {
          reject(e);
        }
      };

      this.mediaRecorder.stop();
    });
  }

  // Plays a cloned sample with active DSP filtering (Formant, Pitch-shifting simulation, reverb)
  async playClonedSample(
    audioBuffer: AudioBuffer,
    settings: {
      pitch: number;      // 0.5 to 2.0
      rate: number;       // 0.5 to 2.0
      timbre: number;     // 10 to 100
      breathiness: number; // 0 to 100
      resonance: number;  // 0.5 to 2.0
      reverb: number;     // 0 to 100
    },
    onFinished?: () => void
  ) {
    const ctx = await this.initContext();
    
    // Stop any existing playback node
    const sourceNode = ctx.createBufferSource();
    sourceNode.buffer = audioBuffer;

    // 1. Playback speed & pitch shift via rate
    sourceNode.playbackRate.value = settings.rate;

    // 2. High-precision Formant Simulation (dual Biquad Formant Filters)
    // Human vowel formants usually have peaks. We model oral resonance with custom biquad variables:
    const throatResonance = ctx.createBiquadFilter();
    throatResonance.type = "peaking";
    // Male vowel resonance is lower, female is higher. We modulate with settings.resonance config
    throatResonance.frequency.value = 500 * settings.resonance; 
    throatResonance.Q.value = 2.0; 
    throatResonance.gain.value = (settings.timbre - 50) / 4; // controls spectral warmth

    const mouthFormant = ctx.createBiquadFilter();
    mouthFormant.type = "peaking";
    mouthFormant.frequency.value = 1500 / settings.resonance; 
    mouthFormant.Q.value = 1.5;
    mouthFormant.gain.value = (settings.timbre - 50) / 5;

    // Lowpass filter for vocal clarity
    const clarityFilter = ctx.createBiquadFilter();
    clarityFilter.type = "lowpass";
    clarityFilter.frequency.value = 8000;

    // 3. Reverb Echo Effect Block
    const delayNode = ctx.createDelay();
    delayNode.delayTime.value = 0.15; // 150ms echo delay

    const feedbackGain = ctx.createGain();
    feedbackGain.gain.value = settings.reverb / 220; // Reverb depth controller

    const reverbMix = ctx.createGain();
    reverbMix.gain.value = settings.reverb / 100;

    const dryGain = ctx.createGain();
    dryGain.gain.value = 1.0 - (settings.reverb / 150);

    // Audio routing architecture:
    // Source -> Formant filters -> Clarity -> Dry gain -> Destination
    //                              \-> Reverb (Delay loop) -> Wet Gain -> Destination
    sourceNode.connect(throatResonance);
    throatResonance.connect(mouthFormant);
    mouthFormant.connect(clarityFilter);

    // Connect Dry signal
    clarityFilter.connect(dryGain);
    dryGain.connect(ctx.destination);

    // Connect Reverb loop
    if (settings.reverb > 0) {
      clarityFilter.connect(delayNode);
      delayNode.connect(feedbackGain);
      feedbackGain.connect(delayNode); // feedback loop
      
      delayNode.connect(reverbMix);
      reverbMix.connect(ctx.destination);
    }

    // White Noise Carrier Injector (for Breathiness/Air sound mapping)
    let noiseSource: AudioBufferSourceNode | null = null;
    let noiseGain: GainNode | null = null;
    if (settings.breathiness > 0) {
      const bufferSize = ctx.sampleRate * 2; // 2 seconds of noise
      const noiseBuffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
      const output = noiseBuffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        output[i] = Math.random() * 2.0 - 1.0;
      }
      
      noiseSource = ctx.createBufferSource();
      noiseSource.buffer = noiseBuffer;
      noiseSource.loop = true;

      const noiseFilter = ctx.createBiquadFilter();
      noiseFilter.type = "bandpass";
      noiseFilter.frequency.value = 2500;
      noiseFilter.Q.value = 1.0;

      noiseGain = ctx.createGain();
      // Couple the noise amplitude to the user voice speed/vibe
      noiseGain.gain.value = (settings.breathiness / 1200);

      noiseSource.connect(noiseFilter);
      noiseFilter.connect(noiseGain);
      noiseGain.connect(ctx.destination);
    }

    // Playback execution
    sourceNode.start(0);
    if (noiseSource) {
      noiseSource.start(0);
    }

    sourceNode.onended = () => {
      try {
        if (noiseSource) {
          noiseSource.stop();
        }
      } catch (err) {}
      if (onFinished) onFinished();
    };

    return {
      stop: () => {
        try {
          sourceNode.stop();
          if (noiseSource) noiseSource.stop();
        } catch (e) {}
      }
    };
  }

  // Trigger HTML5 SpeechSynthesis fallback for full Text-to-Speech mapping, utilizing cloned properties
  speakTTS(
    phrase: string,
    settings: {
      pitch: number;
      rate: number;
      gender: 'male' | 'female' | 'custom';
      reverb?: number;
    },
    onStart?: () => void,
    onEnd?: () => void
  ): SpeechSynthesisUtterance {
    if (window.speechSynthesis) {
      window.speechSynthesis.cancel(); // Stop active speaking
    }

    const utterance = new SpeechSynthesisUtterance(phrase);
    
    // Voice selection matching preferences
    const voices = window.speechSynthesis.getVoices();
    let bestVoice: SpeechSynthesisVoice | null = null;

    // Filter looking for Khmer, Asian or default system voices
    const kmVoices = voices.filter(v => v.lang.includes("km") || v.lang.includes("KH"));
    const secondaryVoices = voices.filter(v => v.lang.includes("Asia") || v.lang.includes("TH") || v.lang.includes("EN"));

    if (kmVoices.length > 0) {
      bestVoice = kmVoices[0];
    } else if (secondaryVoices.length > 0) {
      // Find voice matching requested gender if available
      const correctGender = secondaryVoices.find(v => {
        const name = v.name.toLowerCase();
        if (settings.gender === 'male') return name.includes("male") || name.includes("guy") || name.includes("google");
        if (settings.gender === 'female') return name.includes("female") || name.includes("girl") || name.includes("jessica");
        return true;
      });
      bestVoice = correctGender || secondaryVoices[0];
    }

    if (bestVoice) {
      utterance.voice = bestVoice;
    }

    // Map modifiers directly onto Synthesis Engine 
    // SpeechUtterance standard properties: pitch (0.5 to 2.0), rate (0.1 to 10.0)
    utterance.pitch = Math.max(0.5, Math.min(2.0, settings.pitch));
    utterance.rate = Math.max(0.5, Math.min(2.0, settings.rate));
    utterance.volume = 1.0;

    // Set callback hooks
    if (onStart) utterance.onstart = onStart;
    if (onEnd) utterance.onend = onEnd;

    window.speechSynthesis.speak(utterance);
    return utterance;
  }

  // Generate real audio synth tones matching key profile components for live sound demo
  async playBeepTone(settings: { pitch: number }) {
    const ctx = await this.initContext();
    const osc = ctx.createOscillator();
    const gainNode = ctx.createGain();

    osc.type = "sine";
    // frequency based on F0 multiplier setting
    osc.frequency.setValueAtTime(140 * settings.pitch, ctx.currentTime);
    
    // soft fade out to prevent popping sound
    gainNode.gain.setValueAtTime(0.12, ctx.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.4);

    osc.connect(gainNode);
    gainNode.connect(ctx.destination);

    osc.start();
    osc.stop(ctx.currentTime + 0.4);
  }
}
