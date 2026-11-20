// ============================================================
//  Unit Tests: Translator (/api/translate)
// ============================================================
const mockGemini = require("../helpers/mockGemini");
jest.mock("@google/generative-ai", () => mockGemini);

const request = require("supertest");
const { app } = require("../../server");

const VALID_KEY = "AIzaSyB_test_key_1234567890";

beforeEach(() => {
  mockGemini.resetMocks();
});

describe("POST /api/translate", () => {
  test("returns 400 when no text provided", async () => {
    const res = await request(app)
      .post("/api/translate")
      .send({ apiKey: VALID_KEY });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/text/i);
  });

  test("returns 400 when text is empty", async () => {
    const res = await request(app)
      .post("/api/translate")
      .send({ text: "", apiKey: VALID_KEY });
    expect(res.status).toBe(400);
  });

  test("returns 400 when no API key", async () => {
    const res = await request(app)
      .post("/api/translate")
      .send({ text: "Hello" });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/key/i);
  });

  test("translates English to Hindi", async () => {
    mockGemini.setMockSuccess("नमस्ते");
    const res = await request(app)
      .post("/api/translate")
      .send({ text: "Hello", sourceLang: "English", targetLang: "Hindi", apiKey: VALID_KEY });
    expect(res.status).toBe(200);
    expect(res.body.result).toBe("नमस्ते");
  });

  test("translates Hindi to English", async () => {
    mockGemini.setMockSuccess("Hello");
    const res = await request(app)
      .post("/api/translate")
      .send({ text: "नमस्ते", sourceLang: "Hindi", targetLang: "English", apiKey: VALID_KEY });
    expect(res.status).toBe(200);
    expect(res.body.result).toBe("Hello");
  });

  test("handles auto-detect source language", async () => {
    mockGemini.setMockSuccess("Bonjour");
    const res = await request(app)
      .post("/api/translate")
      .send({ text: "Hello", sourceLang: "Auto-detect", targetLang: "French", apiKey: VALID_KEY });
    expect(res.status).toBe(200);
    expect(res.body.result).toBe("Bonjour");
  });

  test("defaults to Hindi target when not specified", async () => {
    mockGemini.setMockSuccess("नमस्ते");
    const res = await request(app)
      .post("/api/translate")
      .send({ text: "Hello", apiKey: VALID_KEY });
    expect(res.status).toBe(200);
    expect(res.body.result).toBeDefined();
  });

  test("handles special characters in text", async () => {
    mockGemini.setMockSuccess("Translated: test@123 & more");
    const res = await request(app)
      .post("/api/translate")
      .send({ text: "test@123 & more!", sourceLang: "English", targetLang: "Hindi", apiKey: VALID_KEY });
    expect(res.status).toBe(200);
  });

  test("handles multiline text", async () => {
    mockGemini.setMockSuccess("Line 1\nLine 2");
    const res = await request(app)
      .post("/api/translate")
      .send({ text: "Line 1\nLine 2", sourceLang: "English", targetLang: "Hindi", apiKey: VALID_KEY });
    expect(res.status).toBe(200);
    expect(res.body.result).toContain("\n");
  });

  test("handles Gemini API error gracefully", async () => {
    mockGemini.setMockInvalidKey();
    const res = await request(app)
      .post("/api/translate")
      .send({ text: "Hello", apiKey: VALID_KEY });
    expect(res.status).toBe(500);
    expect(res.body.error).toBeDefined();
  });
});
