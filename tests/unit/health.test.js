// ============================================================
//  Unit Tests: Health Check + Utility Functions
// ============================================================
jest.mock("@google/generative-ai", () => require("../helpers/mockGemini"));

const request = require("supertest");
const { app, sanitize, validateApiKey } = require("../../server");

describe("GET /api/health", () => {
  test("returns status ok", async () => {
    const res = await request(app).get("/api/health");
    expect(res.status).toBe(200);
    expect(res.body.status).toBe("ok");
  });

  test("returns models array", async () => {
    const res = await request(app).get("/api/health");
    expect(res.body.models).toBeDefined();
    expect(Array.isArray(res.body.models)).toBe(true);
    expect(res.body.models.length).toBeGreaterThan(0);
  });

  test("returns timestamp", async () => {
    const res = await request(app).get("/api/health");
    expect(res.body.timestamp).toBeDefined();
    expect(new Date(res.body.timestamp).getTime()).not.toBeNaN();
  });
});

describe("sanitize()", () => {
  test("strips HTML tags", () => {
    expect(sanitize("<script>alert('xss')</script>Hello")).toBe("alert('xss')Hello");
  });

  test("strips nested HTML", () => {
    expect(sanitize("<div><b>Bold</b></div>")).toBe("Bold");
  });

  test("trims whitespace", () => {
    expect(sanitize("  hello  ")).toBe("hello");
  });

  test("returns empty string for non-string input", () => {
    expect(sanitize(null)).toBe("");
    expect(sanitize(undefined)).toBe("");
    expect(sanitize(123)).toBe("");
  });

  test("preserves normal text", () => {
    expect(sanitize("Hello, World!")).toBe("Hello, World!");
  });

  test("preserves Hindi/Unicode text", () => {
    expect(sanitize("नमस्ते दुनिया")).toBe("नमस्ते दुनिया");
  });
});

describe("validateApiKey()", () => {
  test("rejects empty string", () => {
    expect(validateApiKey("")).toBe(false);
  });

  test("rejects null/undefined", () => {
    expect(validateApiKey(null)).toBe(false);
    expect(validateApiKey(undefined)).toBe(false);
  });

  test("rejects too short key", () => {
    expect(validateApiKey("abc")).toBe(false);
  });

  test("rejects too long key (>256 chars)", () => {
    expect(validateApiKey("a".repeat(300))).toBe(false);
  });

  test("accepts valid-length key", () => {
    expect(validateApiKey("AIzaSyB_valid_test_key_12345")).toBe(true);
  });

  test("rejects non-string input", () => {
    expect(validateApiKey(12345)).toBe(false);
    expect(validateApiKey({})).toBe(false);
  });
});
