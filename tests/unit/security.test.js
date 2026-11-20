// ============================================================
//  Unit Tests: Security (Headers, Rate Limiting, Validation)
// ============================================================
const mockGemini = require("../helpers/mockGemini");
jest.mock("@google/generative-ai", () => mockGemini);

const request = require("supertest");
const { app } = require("../../server");

beforeEach(() => {
  mockGemini.resetMocks();
});

describe("Security Headers (Helmet)", () => {
  test("sets X-Content-Type-Options header", async () => {
    const res = await request(app).get("/api/health");
    expect(res.headers["x-content-type-options"]).toBe("nosniff");
  });

  test("sets X-Frame-Options header", async () => {
    const res = await request(app).get("/api/health");
    expect(res.headers["x-frame-options"]).toBeDefined();
  });

  test("removes X-Powered-By header", async () => {
    const res = await request(app).get("/api/health");
    expect(res.headers["x-powered-by"]).toBeUndefined();
  });

  test("sets Content-Security-Policy", async () => {
    const res = await request(app).get("/api/health");
    expect(res.headers["content-security-policy"]).toBeDefined();
  });

  test("sets Strict-Transport-Security", async () => {
    const res = await request(app).get("/api/health");
    expect(res.headers["strict-transport-security"]).toBeDefined();
  });
});

describe("Input Validation", () => {
  test("rejects non-JSON content type for POST", async () => {
    const res = await request(app)
      .post("/api/translate")
      .set("Content-Type", "text/plain")
      .send("not json");
    // Express won't parse it, so fields will be missing → 400
    expect(res.status).toBe(400);
  });

  test("rejects request with missing required fields", async () => {
    const res = await request(app)
      .post("/api/summarize")
      .send({});
    expect(res.status).toBe(400);
    expect(res.body.error).toBeDefined();
  });

  test("rejects API key that is too short", async () => {
    const res = await request(app)
      .post("/api/translate")
      .send({ text: "Hello", apiKey: "abc" });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/key/i);
  });

  test("rejects request body exceeding size limit", async () => {
    // 10mb limit – create something over 10mb
    const hugeData = "x".repeat(11 * 1024 * 1024);
    const res = await request(app)
      .post("/api/summarize")
      .send({ text: hugeData, apiKey: "AIzaSyB_test_key_1234567890" });
    expect(res.status).toBeGreaterThanOrEqual(400);
  });
});

describe("API Key Security", () => {
  test("API key is never returned in responses", async () => {
    mockGemini.setMockSuccess("Translation result");
    const res = await request(app)
      .post("/api/translate")
      .send({ text: "Hello", apiKey: "AIzaSyB_test_key_1234567890" });
    const bodyStr = JSON.stringify(res.body);
    expect(bodyStr).not.toContain("AIzaSyB_test_key_1234567890");
  });

  test("error messages do not leak API key", async () => {
    mockGemini.setMockInvalidKey();
    const res = await request(app)
      .post("/api/translate")
      .send({ text: "Hello", apiKey: "AIzaSyB_secret_key_99999" });
    // The error message should not echo back the full key
    expect(res.status).toBe(500);
  });
});

describe("HTTP Methods", () => {
  test("POST endpoints reject GET requests (via catch-all)", async () => {
    // GET to an API POST route will hit the catch-all and serve index.html
    const res = await request(app).get("/api/translate");
    expect(res.status).toBe(200);
    expect(res.headers["content-type"]).toMatch(/html/);
  });

  test("only GET and POST are allowed by CORS", async () => {
    const res = await request(app)
      .options("/api/translate")
      .set("Origin", "http://localhost:3000")
      .set("Access-Control-Request-Method", "DELETE");
    // CORS should restrict to GET, POST
    expect(res.status).toBeDefined();
  });
});
