/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface VoiceProfile {
  id: string;
  name: string;
  description: string;
  gender: 'male' | 'female' | 'custom';
  createdAt: string;
  pitch: number; // Pitch multiplier (0.5 to 2.0, default 1.0)
  rate: number;  // Speed multiplier (0.5 to 2.0, default 1.0)
  timbre: number; // Spectral warmth/brightness (0 to 100, default 50)
  breathiness: number; // Air/breath noise level (0 to 100, default 10)
  resonance: number; // Throat resonance frequency multiplier (0.5 to 2.0, default 1.0)
  reverb: number; // Reverb echo room size (0 to 100, default 0)
  agePreset: 'child' | 'young' | 'mature' | 'senior';
  isCustom: boolean;
  sampleText?: string;
  sampleF0?: number; // Calculated pitch in Hz
  sampleClarity?: number; // Spectral density clarity percentage
}

export interface VoiceAnalysis {
  pitchMin: number;
  pitchMax: number;
  pitchAvg: number;
  tempo: number;
  clarity: number;
  spectralData: number[];
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  audioUrl?: string;
  timestamp: string;
}
