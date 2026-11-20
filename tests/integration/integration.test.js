// ============================================================
//  Integration Tests: Full API request/response cycles
//  Tests multiple features working together end-to-end
// ============================================================
const mockGemini = require("../helpers/mockGemini");
jest.mock("@google/generative-ai", () => mockGemini);

const request = require("supertest");
const { app } = require("../../server");

const VALID_KEY = "AIzaSyB_test_key_1234567890";
const TINY_IMAGE = "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAP/bAEMABgQFBgUEBgYFBgcHBggKEAoKCQkKFA4PDBAXFBgYFxQWFhodJR8aGyMcFhYgLCAjJicpKikZHy0wLSgwJSj/2wBDAQcHBwoIChMKChMoGhYaKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCj/wgARCAABAAEDASIAAhEBAxEB/8QAFAABAAAAAAAAAAAAAAAAAAAAB//EABUBAQEAAAAAAAAAAAAAAAAAAAAB/9oADAMBAAIQAxAAAAFJ/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABBQJ//8QAFBEBAAAAAAAAAAAAAAAAAAAAAP/aAAgBAwEBPwF//8QAFBEBAAAAAAAAAAAAAAAAAAAAAP/aAAgBAgEBPwF//8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQAGPwJ//8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPyF//9oADAMBAAIAAwAAABCf/8QAFBEBAAAAAAAAAAAAAAAAAAAAAP/aAAgBAwEBPxB//8QAFBEBAAAAAAAAAAAAAAAAAAAAAP/aAAgBAgEBPxB//8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPxB//9k=";

beforeEach(() => {
  mockGemini.resetMocks();
});

// ---- Full workflow: Health → Translate → Summarize ----
describe("Integration: Multi-endpoint workflow", () => {
  test("health check passes before any AI call", async () => {
    const health = await request(app).get("/api/health");
    expect(health.status).toBe(200);
    expect(health.body.status).toBe("ok");
  });

  test("translate then summarize in sequence", async () => {
    // Step 1: Translate
    mockGemini.setMockSuccess("यह एक परीक्षण वाक्य है।");
    const translateRes = await request(app)
      .post("/api/translate")
      .send({ text: "This is a test sentence.", sourceLang: "English", targetLang: "Hindi", apiKey: VALID_KEY });
    expect(translateRes.status).toBe(200);
    expect(translateRes.body.result).toBeDefined();

    // Step 2: Summarize the translated text
    mockGemini.setMockSuccess("सारांश: यह एक परीक्षण है।");
    const longText = (translateRes.body.result + " ").repeat(20); // make it longer
    const sumRes = await request(app)
      .post("/api/summarize")
      .send({ text: longText, language: "hindi", apiKey: VALID_KEY });
    expect(sumRes.status).toBe(200);
    expect(sumRes.body.result).toBeDefined();
  });

  test("voice command navigates, then camera analyses", async () => {
    // Step 1: Voice command → navigate to camera
    mockGemini.setMockSuccess(JSON.stringify({
      action: "navigate", target: "camera",
      confidence: 0.95, spoken_response: "Opening camera."
    }));
    const voiceRes = await request(app)
      .post("/api/voice-command")
      .send({ command: "open camera please", apiKey: VALID_KEY });
    expect(voiceRes.status).toBe(200);
    expect(voiceRes.body.result.target).toBe("camera");

    // Step 2: Camera capture → analyse image
    mockGemini.setMockSuccess("A white wall with a clock showing 3pm");
    const camRes = await request(app)
      .post("/api/analyze-image")
      .send({ image: TINY_IMAGE, mode: "identify", apiKey: VALID_KEY });
    expect(camRes.status).toBe(200);
    expect(camRes.body.result).toContain("clock");
  });
});

// ---- Error recovery across endpoints ----
describe("Integration: Error recovery", () => {
  test("API recovers after a failed request", async () => {
    // First request fails
    mockGemini.setMockInvalidKey();
    const failRes = await request(app)
      .post("/api/translate")
      .send({ text: "Hello", apiKey: VALID_KEY });
    expect(failRes.status).toBe(500);

    // Second request succeeds (different key / fixed issue)
    mockGemini.setMockSuccess("नमस्ते");
    const okRes = await request(app)
      .post("/api/translate")
      .send({ text: "Hello", apiKey: VALID_KEY });
    expect(okRes.status).toBe(200);
    expect(okRes.body.result).toBe("नमस्ते");
  });

  test("one endpoint failure doesn't break others", async () => {
    // Summarize fails
    mockGemini.setMockNetworkError();
    const failRes = await request(app)
      .post("/api/summarize")
      .send({ text: "Some long text for testing purposes and analysis", apiKey: VALID_KEY });
    expect(failRes.status).toBe(500);

    // Translate still works
    mockGemini.setMockSuccess("Bonjour");
    const okRes = await request(app)
      .post("/api/translate")
      .send({ text: "Hello", sourceLang: "English", targetLang: "French", apiKey: VALID_KEY });
    expect(okRes.status).toBe(200);
    expect(okRes.body.result).toBe("Bonjour");
  });
});

// ---- Concurrent requests ----
describe("Integration: Concurrent requests", () => {
  test("handles multiple simultaneous requests", async () => {
    mockGemini.setMockSuccess("Concurrent result");

    const requests = [
      request(app).post("/api/translate").send({ text: "Hello", apiKey: VALID_KEY }),
      request(app).post("/api/translate").send({ text: "World", apiKey: VALID_KEY }),
      request(app).post("/api/summarize").send({ text: "A long document about technology and science and innovation", apiKey: VALID_KEY }),
      request(app).get("/api/health"),
    ];

    const results = await Promise.all(requests);

    expect(results[0].status).toBe(200);
    expect(results[1].status).toBe(200);
    expect(results[2].status).toBe(200);
    expect(results[3].status).toBe(200);
  });
});

// ---- Edge cases across endpoints ----
describe("Integration: Edge cases", () => {
  test("all endpoints reject empty body", async () => {
    const endpoints = ["/api/analyze-image", "/api/summarize", "/api/translate", "/api/voice-command"];
    for (const ep of endpoints) {
      const res = await request(app).post(ep).send({});
      expect(res.status).toBe(400);
      expect(res.body.error).toBeDefined();
    }
  });

  test("all endpoints reject missing API key", async () => {
    const payloads = [
      { url: "/api/analyze-image", body: { image: TINY_IMAGE } },
      { url: "/api/summarize", body: { text: "Some text to summarize for testing" } },
      { url: "/api/translate", body: { text: "Hello" } },
      { url: "/api/voice-command", body: { command: "go home" } },
    ];
    for (const p of payloads) {
      const res = await request(app).post(p.url).send(p.body);
      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/key/i);
    }
  });

  test("all endpoints return JSON error format", async () => {
    mockGemini.setMockNetworkError();
    const endpoints = [
      { url: "/api/analyze-image", body: { image: TINY_IMAGE, apiKey: VALID_KEY } },
      { url: "/api/summarize", body: { text: "Text for summarization testing", apiKey: VALID_KEY } },
      { url: "/api/translate", body: { text: "Hello", apiKey: VALID_KEY } },
      { url: "/api/voice-command", body: { command: "open camera", apiKey: VALID_KEY } },
    ];
    for (const ep of endpoints) {
      const res = await request(app).post(ep.url).send(ep.body);
      expect(res.status).toBe(500);
      expect(res.headers["content-type"]).toMatch(/json/);
      expect(res.body.error).toBeDefined();
      expect(typeof res.body.error).toBe("string");
    }
  });

  test("static files are served correctly", async () => {
    const res = await request(app).get("/");
    expect(res.status).toBe(200);
    expect(res.headers["content-type"]).toMatch(/html/);
  });

  test("unknown routes serve index.html (SPA fallback)", async () => {
    const res = await request(app).get("/some/random/page");
    expect(res.status).toBe(200);
    expect(res.headers["content-type"]).toMatch(/html/);
  });
});
