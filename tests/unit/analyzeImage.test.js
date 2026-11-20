// ============================================================
//  Unit Tests: Camera AI (/api/analyze-image)
// ============================================================
const mockGemini = require("../helpers/mockGemini");
jest.mock("@google/generative-ai", () => mockGemini);

const request = require("supertest");
const { app } = require("../../server");

const VALID_KEY = "AIzaSyB_test_key_1234567890";
// Tiny valid base64 JPEG (1x1 pixel)
const TINY_IMAGE = "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAP/bAEMABgQFBgUEBgYFBgcHBggKEAoKCQkKFA4PDBAXFBgYFxQWFhodJR8aGyMcFhYgLCAjJicpKikZHy0wLSgwJSj/2wBDAQcHBwoIChMKChMoGhYaKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCj/wgARCAABAAEDASIAAhEBAxEB/8QAFAABAAAAAAAAAAAAAAAAAAAAB//EABUBAQEAAAAAAAAAAAAAAAAAAAAB/9oADAMBAAIQAxAAAAFJ/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABBQJ//8QAFBEBAAAAAAAAAAAAAAAAAAAAAP/aAAgBAwEBPwF//8QAFBEBAAAAAAAAAAAAAAAAAAAAAP/aAAgBAgEBPwF//8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQAGPwJ//8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPyF//9oADAMBAAIAAwAAABCf/8QAFBEBAAAAAAAAAAAAAAAAAAAAAP/aAAgBAwEBPxB//8QAFBEBAAAAAAAAAAAAAAAAAAAAAP/aAAgBAgEBPxB//8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPxB//9k=";

beforeEach(() => {
  mockGemini.resetMocks();
});

describe("POST /api/analyze-image", () => {
  test("returns 400 when no image provided", async () => {
    const res = await request(app)
      .post("/api/analyze-image")
      .send({ apiKey: VALID_KEY });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/image/i);
  });

  test("returns 400 when no API key", async () => {
    const res = await request(app)
      .post("/api/analyze-image")
      .send({ image: TINY_IMAGE });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/key/i);
  });

  test("returns 400 for invalid API key format", async () => {
    const res = await request(app)
      .post("/api/analyze-image")
      .send({ image: TINY_IMAGE, apiKey: "short" });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/key/i);
  });

  test("successfully identifies objects in image", async () => {
    mockGemini.setMockSuccess("A desk with a laptop and coffee mug");
    const res = await request(app)
      .post("/api/analyze-image")
      .send({ image: TINY_IMAGE, mode: "identify", apiKey: VALID_KEY });
    expect(res.status).toBe(200);
    expect(res.body.result).toContain("desk");
  });

  test("successfully reads text from image", async () => {
    mockGemini.setMockSuccess("STOP - Speed Limit 60");
    const res = await request(app)
      .post("/api/analyze-image")
      .send({ image: TINY_IMAGE, mode: "read-text", apiKey: VALID_KEY });
    expect(res.status).toBe(200);
    expect(res.body.result).toContain("STOP");
  });

  test("defaults to identify mode when mode not specified", async () => {
    mockGemini.setMockSuccess("A scenic view");
    const res = await request(app)
      .post("/api/analyze-image")
      .send({ image: TINY_IMAGE, apiKey: VALID_KEY });
    expect(res.status).toBe(200);
    expect(res.body.result).toBeDefined();
  });

  test("returns 400 for invalid mode", async () => {
    const res = await request(app)
      .post("/api/analyze-image")
      .send({ image: TINY_IMAGE, mode: "invalid_mode", apiKey: VALID_KEY });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/mode/i);
  });

  test("handles Gemini API errors gracefully", async () => {
    mockGemini.setMockInvalidKey();
    const res = await request(app)
      .post("/api/analyze-image")
      .send({ image: TINY_IMAGE, apiKey: VALID_KEY });
    expect(res.status).toBe(500);
    expect(res.body.error).toBeDefined();
  });
});
