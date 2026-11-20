// ============================================================
//  Unit Tests: Summarizer (/api/summarize)
// ============================================================
const mockGemini = require("../helpers/mockGemini");
jest.mock("@google/generative-ai", () => mockGemini);

const request = require("supertest");
const { app } = require("../../server");

const VALID_KEY = "AIzaSyB_test_key_1234567890";
const SAMPLE_TEXT = "Artificial intelligence is transforming the world. It helps in healthcare, education, and many other fields. Machine learning algorithms can detect patterns in large datasets.";

beforeEach(() => {
  mockGemini.resetMocks();
});

describe("POST /api/summarize", () => {
  test("returns 400 when no text provided", async () => {
    const res = await request(app)
      .post("/api/summarize")
      .send({ apiKey: VALID_KEY });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/text/i);
  });

  test("returns 400 when text is empty string", async () => {
    const res = await request(app)
      .post("/api/summarize")
      .send({ text: "", apiKey: VALID_KEY });
    expect(res.status).toBe(400);
  });

  test("returns 400 when no API key", async () => {
    const res = await request(app)
      .post("/api/summarize")
      .send({ text: SAMPLE_TEXT });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/key/i);
  });

  test("successfully summarizes in English", async () => {
    mockGemini.setMockSuccess("AI is changing healthcare and education.");
    const res = await request(app)
      .post("/api/summarize")
      .send({ text: SAMPLE_TEXT, language: "english", apiKey: VALID_KEY });
    expect(res.status).toBe(200);
    expect(res.body.result).toContain("AI");
  });

  test("successfully summarizes in Hindi", async () => {
    mockGemini.setMockSuccess("एआई स्वास्थ्य और शिक्षा बदल रही है।");
    const res = await request(app)
      .post("/api/summarize")
      .send({ text: SAMPLE_TEXT, language: "hindi", apiKey: VALID_KEY });
    expect(res.status).toBe(200);
    expect(res.body.result).toBeDefined();
  });

  test("successfully summarizes in both languages", async () => {
    mockGemini.setMockSuccess("**English Summary**\nAI is growing.\n\n**हिंदी सारांश**\nएआई बढ़ रही है।");
    const res = await request(app)
      .post("/api/summarize")
      .send({ text: SAMPLE_TEXT, language: "both", apiKey: VALID_KEY });
    expect(res.status).toBe(200);
    expect(res.body.result).toContain("English");
  });

  test("defaults to English when language not specified", async () => {
    mockGemini.setMockSuccess("Summary in English");
    const res = await request(app)
      .post("/api/summarize")
      .send({ text: SAMPLE_TEXT, apiKey: VALID_KEY });
    expect(res.status).toBe(200);
    expect(res.body.result).toBeDefined();
  });

  test("returns 400 for invalid language option", async () => {
    const res = await request(app)
      .post("/api/summarize")
      .send({ text: SAMPLE_TEXT, language: "klingon", apiKey: VALID_KEY });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/language/i);
  });

  test("handles very long text (truncation)", async () => {
    mockGemini.setMockSuccess("Summary of long text");
    const longText = "A".repeat(40000);
    const res = await request(app)
      .post("/api/summarize")
      .send({ text: longText, apiKey: VALID_KEY });
    // Should still succeed – server truncates to 30000 internally
    expect(res.status).toBe(200);
  });

  test("sanitizes HTML in input text", async () => {
    mockGemini.setMockSuccess("Clean summary");
    const res = await request(app)
      .post("/api/summarize")
      .send({ text: "<script>alert('xss')</script>Normal text here plus more content", apiKey: VALID_KEY });
    expect(res.status).toBe(200);
    expect(res.body.result).not.toContain("<script>");
  });

  test("handles Gemini API error", async () => {
    mockGemini.setMockNetworkError();
    const res = await request(app)
      .post("/api/summarize")
      .send({ text: SAMPLE_TEXT, apiKey: VALID_KEY });
    expect(res.status).toBe(500);
    expect(res.body.error).toBeDefined();
  });
});
