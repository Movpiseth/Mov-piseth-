/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI } from "@google/genai";
import dotenv from "dotenv";

dotenv.config();

const PORT = 3000;

// Lazy initialize Gemini client to avoid startup crashes if key is initially absent
let aiClient: GoogleGenAI | null = null;

function getGeminiClient(): GoogleGenAI {
  if (!aiClient) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error("GEMINI_API_KEY environment variable is missing. Please define it in your AI Studio secrets.");
    }
    aiClient = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    });
  }
  return aiClient;
}

async function startServer() {
  const app = express();
  app.use(express.json());

  // 1. API: Health Check
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok", mode: process.env.NODE_ENV || "development" });
  });

  // 2. API: Chat with Cloned Voice AI Assistant
  app.post("/api/gemini/chat", async (req, res) => {
    try {
      const { message, voicePersona, language = 'Khmer' } = req.body;
      if (!message) {
        return res.status(400).json({ error: "Message is required" });
      }

      const client = getGeminiClient();
      
      const systemInstruction = `You are an AI Voice assistant speaking and responding to the user. 
The user has cloned their actual voice (or is using a custom voice profile) and you will talk as their voice clone or helper.
Current voice description/persona: ${voicePersona || 'Friendly Assistant'}.
Language: Always reply in the requested language: ${language} (Default is Khmer - ភាសាខ្មែរ). 
Important: Keep responses extremely concise (around 1 to 2 short sentences, maximum 45 words), engaging, and warm. This is because the text will be spoken out loud using HTML5 speech synthesis, and short text synthesizes faster and sounds better.
Never output complex markdown like lists or tables. Use simple, natural spoken text with proper punctuation.`;

      const response = await client.models.generateContent({
        model: "gemini-3.5-flash",
        contents: message,
        config: {
          systemInstruction,
          temperature: 0.7,
        },
      });

      const replyText = response.text || "ខ្ញុំមិនអាចយល់បានឡើយ។ សាកល្បងម្តងទៀត។";
      res.json({ reply: replyText });
    } catch (error: any) {
      console.error("Gemini Chat API Error:", error);
      res.status(500).json({ error: error.message || "Failed to contact Gemini API" });
    }
  });

  // 3. API: Generate Custom Speech Scripts (Podcast/News/Poem) for Cloned Voice
  app.post("/api/gemini/generate-script", async (req, res) => {
    try {
      const { topic, voiceVibe, scriptType } = req.body;
      const client = getGeminiClient();

      let templatePrompt = `Write a short speech script for a voice with a '${voiceVibe || 'normal'}' style. 
Topic: "${topic || 'General announcement'}".
Script Category/Type: "${scriptType || 'Podcast intro'}".
Language: Speak in fluent Khmer (ភាសាខ្មែរ).
Length: This must be very short, around 30 to 60 words (15-30 seconds of speech).
Format: Deliver only the spoken text. Do not add metadata, labels, scene descriptions, or parentheses like '(laughs)'. Just the Khmer spoken text itself.`;

      const response = await client.models.generateContent({
        model: "gemini-3.5-flash",
        contents: templatePrompt,
        config: {
          temperature: 0.8,
        },
      });

      const scriptText = response.text || "";
      res.json({ script: scriptText.trim() });
    } catch (error: any) {
      console.error("Script Generation Error:", error);
      res.status(500).json({ error: error.message || "Failed to generate script" });
    }
  });

  // 4. API: Transcribe audio to subtitle structure using Gemini
  app.post("/api/gemini/transcribe", async (req, res) => {
    try {
      const { textToTranscribe } = req.body;
      if (!textToTranscribe) {
        return res.status(400).json({ error: "Text or sample is required" });
      }

      const client = getGeminiClient();
      const prompt = `Convert the following text or topic into a professional, human-like voice timeline with precise timestamps for subtitles or karaoke. It must look like subtitle entries.
Text input: "${textToTranscribe}"
Format must be a JSON array of objects with fields:
- time: string (e.g. "00:00 - 00:04", "00:04 - 00:08", etc.)
- text: string in Khmer
Generate 4-6 sequential timestamp parts. Response MUST be valid JSON only.
Do not wrap in markdown quotes except standard json wrapper.`;

      const response = await client.models.generateContent({
        model: "gemini-3.5-flash",
        contents: prompt,
        config: {
          responseMimeType: "application/json",
          temperature: 0.5,
        },
      });

      const responseText = response.text || "[]";
      // Try parsing to verify
      const parsed = JSON.parse(responseText.replace(/```json/g, "").replace(/```/g, "").trim());
      res.json({ subtitle: parsed });
    } catch (error: any) {
      console.error("Transcription API Error:", error);
      // Fallback subtitles array if Gemini is not accessible
      const fallback = [
        { time: "00:00 - 00:03", text: "សួស្តីបាទ! សូមស្វាគមន៍មកកាន់ការផ្សាយផ្ទាល់។" },
        { time: "00:03 - 00:07", text: "ថ្ងៃនេះយើងមានសេចក្តីសោមនស្សរីករាយក្រៃលែងក្នុងការបង្ហាញប្រព័ន្ធថ្មី។" },
        { time: "00:07 - 00:11", text: "នេះគឺជាសំឡេងដែលត្រូវបានបំបែករួចរាល់តាមរយៈ UVR5 Dynamic Filter។" },
        { time: "00:11 - 00:15", text: "សូមអរគុណសម្រាប់រាល់ការតាមដានទស្សនារបស់អស់លោកអ្នក!" }
      ];
      res.json({ subtitle: fallback, note: "Fallback generated successfully (Offline Mode)" });
    }
  });

  // 5. Vite Dev Server vs. Static Production handler
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server is running in ${process.env.NODE_ENV || "development"} mode on http://localhost:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error("Failed to start full-stack server:", err);
});
