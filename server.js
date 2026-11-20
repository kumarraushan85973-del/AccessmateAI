const express = require("express");
const cors = require("cors");
const { GoogleGenerativeAI } = require("@google/generative-ai");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 3000;

// --------------- Middleware ---------------
app.use(cors());
app.use(express.json({ limit: "20mb" }));
app.use(express.static(path.join(__dirname, "public")));

// --------------- Gemini: retry + fallback models ---------------
// If one model is overloaded (503), automatically try the next one.
const MODEL_LIST = [
  "gemini-3.8-flash",
  "gemini-3.5-flash-lite",
  "gemini-2.5-flash-lite"
];

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function callGemini(apiKey, contentParts) {
  if (!apiKey) throw new Error("API key not provided. Please set your Gemini API key in Settings.");

  const genAI = new GoogleGenerativeAI(apiKey);
  let lastError = null;

  for (const modelName of MODEL_LIST) {
    // Try each model up to 3 times
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        console.log(`  → Trying ${modelName} (attempt ${attempt})...`);
        const model = genAI.getGenerativeModel({ model: modelName });
        const result = await model.generateContent(contentParts);
        console.log(`  ✓ Success with ${modelName}`);
        return result.response.text();
      } catch (err) {
        lastError = err;
        const msg = err.message || "";
        // Retry only on 503 (overloaded) or 429 (rate limit)
        if (msg.includes("503") || msg.includes("429") || msg.includes("high demand") || msg.includes("overloaded")) {
          console.log(`  ✗ ${modelName} unavailable: ${msg.substring(0, 80)}`);
          if (attempt < 3) await sleep(2000); // wait before retry
          continue; // try again or move to next model
        }
        // For other errors (bad key, 404, etc.), throw immediately
        throw err;
      }
    }
  }

  throw lastError || new Error("All models are currently unavailable. Please try again in a minute.");
}

// Health check
app.get("/api/health", (_req, res) => {
  res.json({ status: "ok", models: MODEL_LIST });
});

// --------------- 1. Analyse camera image ---------------
app.post("/api/analyze-image", async (req, res) => {
  try {
    const { image, mode, apiKey } = req.body;
    if (!image) return res.status(400).json({ error: "No image provided" });

    const prompt =
      mode === "read-text"
        ? `You are an accessibility assistant for visually impaired users. Look at this image and extract ALL visible text. Read it out clearly, line by line. If there is no text, describe what is in the image instead. Keep the response clear and natural, as it will be read aloud.`
        : `You are an accessibility assistant for visually impaired users. Describe this image in detail. Identify all objects, people, colors, text, and spatial relationships. Be thorough but concise. Structure your response so it is easy to understand when read aloud. Start with the most important elements first.`;

    const base64Data = image.replace(/^data:image\/\w+;base64,/, "");
    const result = await callGemini(apiKey, [
      prompt,
      { inlineData: { mimeType: "image/jpeg", data: base64Data } },
    ]);

    res.json({ result });
  } catch (err) {
    console.error("analyze-image error:", err.message);
    res.status(500).json({ error: err.message || "Image analysis failed" });
  }
});

// --------------- 2. Document Summarisation ---------------
app.post("/api/summarize", async (req, res) => {
  try {
    const { text, language, apiKey } = req.body;
    if (!text) return res.status(400).json({ error: "No text provided" });

    let langInstruction;
    if (language === "hindi") {
      langInstruction = "Provide the summary ONLY in simple Hindi (Devanagari script).";
    } else if (language === "both") {
      langInstruction =
        "Provide the summary in BOTH English and Hindi. Label each section as **English Summary** and **हिंदी सारांश**.";
    } else {
      langInstruction = "Provide the summary in simple, clear English.";
    }

    const prompt = `You are an accessibility assistant that helps people with reading difficulties.

Summarise the following text in a way that is easy to understand. Use simple words, short sentences, and bullet points where helpful. Highlight the key points.

${langInstruction}

--- TEXT START ---
${text.substring(0, 30000)}
--- TEXT END ---`;

    const result = await callGemini(apiKey, prompt);
    res.json({ result });
  } catch (err) {
    console.error("summarize error:", err.message);
    res.status(500).json({ error: err.message || "Summarisation failed" });
  }
});

// --------------- 3. Language Translation ---------------
app.post("/api/translate", async (req, res) => {
  try {
    const { text, sourceLang, targetLang, apiKey } = req.body;
    if (!text) return res.status(400).json({ error: "No text provided" });

    const prompt = `You are a real-time language translator designed for accessibility.

Translate the following text from ${sourceLang || "auto-detect"} to ${targetLang || "Hindi"}.

Rules:
- Provide ONLY the translated text, nothing else.
- Keep the meaning intact.
- Use simple, everyday language.
- Preserve formatting (line breaks, bullets, etc.).

Text to translate:
${text.substring(0, 15000)}`;

    const result = await callGemini(apiKey, prompt);
    res.json({ result });
  } catch (err) {
    console.error("translate error:", err.message);
    res.status(500).json({ error: err.message || "Translation failed" });
  }
});

// --------------- 4. Voice command interpretation ---------------
app.post("/api/voice-command", async (req, res) => {
  try {
    const { command, apiKey } = req.body;
    if (!command) return res.status(400).json({ error: "No command provided" });

    const prompt = `You are a voice-command interpreter for an accessibility app called AccessMate AI.

The app has these pages:
1. "dashboard" – Home page
2. "camera" – AI Camera Assistant
3. "speech-to-text" – Speech to text
4. "text-to-speech" – Text to speech
5. "summarizer" – Document summarisation
6. "translator" – Language translation
7. "settings" – Settings

The user said: "${command}"

Respond ONLY with a JSON object:
{"action":"navigate","target":"<page-id>","confidence":0.95,"spoken_response":"Opening camera for you."}

action = "navigate" or "unknown"
target = page id from list above`;

    const raw = await callGemini(apiKey, prompt);
    const cleaned = raw.replace(/```json\s*/i, "").replace(/```\s*$/, "").trim();
    const parsed = JSON.parse(cleaned);
    res.json({ result: parsed });
  } catch (err) {
    console.error("voice-command error:", err.message);
    res.status(500).json({ error: err.message || "Voice command processing failed" });
  }
});

// Catch-all: serve index.html
app.get("*", (_req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

// Start


app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on port ${PORT}`);
});