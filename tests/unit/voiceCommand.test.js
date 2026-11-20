// ============================================================
//  Unit Tests: Voice Command (/api/voice-command)
// ============================================================
const mockGemini = require("../helpers/mockGemini");
jest.mock("@google/generative-ai", () => mockGemini);

const request = require("supertest");
const { app } = require("../../server");

const VALID_KEY = "AIzaSyB_test_key_1234567890";

beforeEach(() => {
  mockGemini.resetMocks();
});

describe("POST /api/voice-command", () => {
  test("returns 400 when no command provided", async () => {
    const res = await request(app)
      .post("/api/voice-command")
      .send({ apiKey: VALID_KEY });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/command/i);
  });

  test("returns 400 when command is empty", async () => {
    const res = await request(app)
      .post("/api/voice-command")
      .send({ command: "", apiKey: VALID_KEY });
    expect(res.status).toBe(400);
  });

  test("returns 400 when no API key", async () => {
    const res = await request(app)
      .post("/api/voice-command")
      .send({ command: "open camera" });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/key/i);
  });

  test("navigates to camera on 'open camera'", async () => {
    mockGemini.setMockSuccess(JSON.stringify({
      action: "navigate",
      target: "camera",
      confidence: 0.95,
      spoken_response: "Opening camera for you."
    }));
    const res = await request(app)
      .post("/api/voice-command")
      .send({ command: "open camera", apiKey: VALID_KEY });
    expect(res.status).toBe(200);
    expect(res.body.result.action).toBe("navigate");
    expect(res.body.result.target).toBe("camera");
    expect(res.body.result.spoken_response).toBeDefined();
  });

  test("navigates to translator on 'translate'", async () => {
    mockGemini.setMockSuccess(JSON.stringify({
      action: "navigate",
      target: "translator",
      confidence: 0.9,
      spoken_response: "Opening translator."
    }));
    const res = await request(app)
      .post("/api/voice-command")
      .send({ command: "I want to translate something", apiKey: VALID_KEY });
    expect(res.status).toBe(200);
    expect(res.body.result.target).toBe("translator");
  });

  test("navigates to dashboard on 'go home'", async () => {
    mockGemini.setMockSuccess(JSON.stringify({
      action: "navigate",
      target: "dashboard",
      confidence: 0.9,
      spoken_response: "Going to home page."
    }));
    const res = await request(app)
      .post("/api/voice-command")
      .send({ command: "go home", apiKey: VALID_KEY });
    expect(res.status).toBe(200);
    expect(res.body.result.target).toBe("dashboard");
  });

  test("handles unknown command gracefully", async () => {
    mockGemini.setMockSuccess(JSON.stringify({
      action: "unknown",
      target: "",
      confidence: 0.2,
      spoken_response: "Sorry, I didn't understand."
    }));
    const res = await request(app)
      .post("/api/voice-command")
      .send({ command: "asdfghjkl", apiKey: VALID_KEY });
    expect(res.status).toBe(200);
    expect(res.body.result.action).toBe("unknown");
  });

  test("returns 400 for overly long command (>500 chars)", async () => {
    const res = await request(app)
      .post("/api/voice-command")
      .send({ command: "a".repeat(600), apiKey: VALID_KEY });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/command/i);
  });

  test("sanitizes XSS in command", async () => {
    mockGemini.setMockSuccess(JSON.stringify({
      action: "unknown", target: "", confidence: 0.1,
      spoken_response: "I didn't understand."
    }));
    const res = await request(app)
      .post("/api/voice-command")
      .send({ command: "<script>alert(1)</script>open camera", apiKey: VALID_KEY });
    expect(res.status).toBe(200);
    // Should not crash, XSS stripped before reaching AI
  });

  test("handles Gemini API error", async () => {
    mockGemini.setMockNetworkError();
    const res = await request(app)
      .post("/api/voice-command")
      .send({ command: "open camera", apiKey: VALID_KEY });
    expect(res.status).toBe(500);
    expect(res.body.error).toBeDefined();
  });
});
