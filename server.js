// ============================================================
//  AccessMate AI – Server (Security-Hardened + Testable)
// ============================================================
const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");
const hpp = require("hpp");
const { body, validationResult } = require("express-validator");
const { GoogleGenerativeAI } = require("@google/generative-ai");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 3000;

// ===================== SECURITY MIDDLEWARE =====================

// 1. Helmet – sets secure HTTP headers (XSS protection, CSP, etc.)
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      fontSrc: ["'self'", "https://fonts.gstatic.com", "https://fonts.googleapis.com"],
      imgSrc: ["'self'", "data:", "blob:"],
      connectSrc: ["'self'"],
      mediaSrc: ["'self'", "blob:"],
    },
  },
  crossOriginEmbedderPolicy: false,
}));

// 2. CORS – restrict to same-origin in production
app.use(cors({
  origin: process.env.NODE_ENV === "production"
    ? [`http://localhost:${PORT}`]
    : true,
  methods: ["GET", "POST"],
  allowedHeaders: ["Content-Type"],
  maxAge: 86400,
}));

// 3. Rate Limiting – prevent API abuse
const apiLimiter = rateLimit({
  windowMs: 60 * 1000,         // 1 minute window
  max: 30,                     // 30 requests per minute per IP
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many requests. Please wait a moment and try again." },
  keyGenerator: (req) => req.ip,
});
app.use("/api/", apiLimiter);

// 4. Body parsing with size limits
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: false, limit: "1mb" }));

// 5. HPP – prevent HTTP parameter pollution
app.use(hpp());

// 6. Static files
app.use(express.static(path.join(__dirname, "public")));

// ===================== INPUT SANITIZATION =====================

// Strip HTML tags to prevent XSS
function sanitize(str) {
  if (typeof str !== "string") return "";
  return str.replace(/<[^>]*>/g, "").trim();
}

// Validate API key format (basic check – not empty, reasonable length)
function validateApiKey(key) {
  if (!key || typeof key !== "string") return false;
  const trimmed = key.trim();
  return trimmed.length >= 10 && trimmed.length <= 256;
}

// Shared validation middleware for apiKey field
const validateApiKeyField = [
  body("apiKey")
    .exists({ checkFalsy: true }).withMessage("API key is required. Set it in Settings.")
    .isString().withMessage("API key must be a string.")
    .trim()
    .isLength({ min: 10, max: 256 }).withMessage("API key format is invalid."),
];

// Validation error handler
function handleValidationErrors(req, res, next) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      error: errors.array().map(e => e.msg).join(" "),
    });
  }
  next();
}

// ===================== GEMINI: RETRY + FALLBACK =====================

const MODEL_LIST = [
  "gemini-3.8-flash",
  "gemini-3.5-flash-lite",
  "gemini-2.5-flash-lite",
];

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function callGemini(apiKey, contentParts) {
  if (!validateApiKey(apiKey)) {
    throw new Error("Invalid API key. Please check your key in Settings.");
  }

  const genAI = new GoogleGenerativeAI(apiKey.trim());
  let lastError = null;

  for (const modelName of MODEL_LIST) {
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        const model = genAI.getGenerativeModel({ model: modelName });
        const result = await model.generateContent(contentParts);
        return result.response.text();
      } catch (err) {
        lastError = err;
        const msg = err.message || "";
        // Retry only on 503 (overloaded) or 429 (rate limit)
        if (msg.includes("503") || msg.includes("429") || msg.includes("high demand") || msg.includes("overloaded")) {
          if (attempt < 3) await sleep(2000);
          continue;
        }
        // For other errors (bad key, 404, etc.), throw immediately
        throw err;
      }
    }
  }

  throw lastError || new Error("All AI models are currently unavailable. Please try again shortly.");
}

// ===================== API ROUTES =====================

// Health check
app.get("/api/health", (_req, res) => {
  res.json({ status: "ok", models: MODEL_LIST, timestamp: new Date().toISOString() });
});

// 1. Analyse camera image
app.post("/api/analyze-image",
  validateApiKeyField,
  body("image").exists({ checkFalsy: true }).withMessage("No image provided."),
  body("mode").optional().isIn(["identify", "read-text"]).withMessage("Invalid mode."),
  handleValidationErrors,
  async (req, res) => {
    try {
      const { image, mode, apiKey } = req.body;

      const prompt =
        mode === "read-text"
          ? "You are an accessibility assistant for visually impaired users. Look at this image and extract ALL visible text. Read it out clearly, line by line. If there is no text, describe what is in the image instead. Keep the response clear and natural, as it will be read aloud."
          : "You are an accessibility assistant for visually impaired users. Describe this image in detail. Identify all objects, people, colors, text, and spatial relationships. Be thorough but concise. Structure your response so it is easy to understand when read aloud. Start with the most important elements first.";

      const base64Data = image.replace(/^data:image\/\w+;base64,/, "");
      const result = await callGemini(apiKey, [
        prompt,
        { inlineData: { mimeType: "image/jpeg", data: base64Data } },
      ]);

      res.json({ result: sanitize(result) });
    } catch (err) {
      const safeMsg = err.message || "Image analysis failed";
      res.status(500).json({ error: safeMsg });
    }
  }
);

// 2. Document Summarisation
app.post("/api/summarize",
  validateApiKeyField,
  body("text").exists({ checkFalsy: true }).withMessage("No text provided.")
    .isString().isLength({ min: 1, max: 50000 }).withMessage("Text must be between 1 and 50,000 characters."),
  body("language").optional().isIn(["english", "hindi", "both"]).withMessage("Invalid language option."),
  handleValidationErrors,
  async (req, res) => {
    try {
      const { text, language, apiKey } = req.body;
      const cleanText = sanitize(text);

      let langInstruction;
      if (language === "hindi") {
        langInstruction = "Provide the summary ONLY in simple Hindi (Devanagari script).";
      } else if (language === "both") {
        langInstruction = "Provide the summary in BOTH English and Hindi. Label each section as **English Summary** and **हिंदी सारांश**.";
      } else {
        langInstruction = "Provide the summary in simple, clear English.";
      }

      const prompt = `You are an accessibility assistant that helps people with reading difficulties.

Summarise the following text in a way that is easy to understand. Use simple words, short sentences, and bullet points where helpful. Highlight the key points.

${langInstruction}

--- TEXT START ---
${cleanText.substring(0, 30000)}
--- TEXT END ---`;

      const result = await callGemini(apiKey, prompt);
      res.json({ result });
    } catch (err) {
      const safeMsg = err.message || "Summarisation failed";
      res.status(500).json({ error: safeMsg });
    }
  }
);

// 3. Language Translation
app.post("/api/translate",
  validateApiKeyField,
  body("text").exists({ checkFalsy: true }).withMessage("No text provided.")
    .isString().isLength({ min: 1, max: 20000 }).withMessage("Text must be between 1 and 20,000 characters."),
  body("sourceLang").optional().isString().trim(),
  body("targetLang").optional().isString().trim(),
  handleValidationErrors,
  async (req, res) => {
    try {
      const { text, sourceLang, targetLang, apiKey } = req.body;
      const cleanText = sanitize(text);
      const safeSrc = sanitize(sourceLang || "auto-detect");
      const safeTgt = sanitize(targetLang || "Hindi");

      const prompt = `You are a real-time language translator designed for accessibility.

Translate the following text from ${safeSrc} to ${safeTgt}.

Rules:
- Provide ONLY the translated text, nothing else.
- Keep the meaning intact.
- Use simple, everyday language.
- Preserve formatting (line breaks, bullets, etc.).

Text to translate:
${cleanText.substring(0, 15000)}`;

      const result = await callGemini(apiKey, prompt);
      res.json({ result });
    } catch (err) {
      const safeMsg = err.message || "Translation failed";
      res.status(500).json({ error: safeMsg });
    }
  }
);

// 4. Voice command interpretation
app.post("/api/voice-command",
  validateApiKeyField,
  body("command").exists({ checkFalsy: true }).withMessage("No command provided.")
    .isString().isLength({ min: 1, max: 500 }).withMessage("Command too long."),
  handleValidationErrors,
  async (req, res) => {
    try {
      const { command, apiKey } = req.body;
      const cleanCmd = sanitize(command);

      const prompt = `You are a voice-command interpreter for an accessibility app called AccessMate AI.

The app has these pages:
1. "dashboard" – Home page
2. "camera" – AI Camera Assistant
3. "speech-to-text" – Speech to text
4. "text-to-speech" – Text to speech
5. "summarizer" – Document summarisation
6. "translator" – Language translation
7. "settings" – Settings

The user said: "${cleanCmd}"

Respond ONLY with a JSON object:
{"action":"navigate","target":"<page-id>","confidence":0.95,"spoken_response":"Opening camera for you."}

action = "navigate" or "unknown"
target = page id from list above`;

      const raw = await callGemini(apiKey, prompt);
      const cleaned = raw.replace(/```json\s*/i, "").replace(/```\s*$/, "").trim();
      const parsed = JSON.parse(cleaned);
      res.json({ result: parsed });
    } catch (err) {
      const safeMsg = err.message || "Voice command processing failed";
      res.status(500).json({ error: safeMsg });
    }
  }
);

// ===================== CATCH-ALL =====================
app.get("*", (_req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

// ===================== GLOBAL ERROR HANDLER =====================
app.use((err, _req, res, _next) => {
  console.error("Unhandled error:", err.message);
  res.status(500).json({ error: "An unexpected error occurred." });
});

// ===================== START SERVER =====================
// Only listen when run directly (not when imported for testing)
if (require.main === module) {
  app.listen(PORT, "0.0.0.0", () => {
    console.log("");
    console.log("  ============================================");
    console.log("  AccessMate AI is running!");
    console.log(`  Open: http://localhost:${PORT}`);
    console.log("  ============================================");
    console.log("  Security: Helmet, CORS, Rate-limit, HPP, Input validation");
    console.log("  Models (fallback order):");
    MODEL_LIST.forEach((m, i) => console.log(`    ${i + 1}. ${m}`));
    console.log("");
  });
}

// Export for testing
module.exports = { app, sanitize, validateApiKey, callGemini, MODEL_LIST };
