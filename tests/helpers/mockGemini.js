// ============================================================
//  Mock for @google/generative-ai module
//  Used by all tests to avoid real API calls
// ============================================================

const mockGenerateContent = jest.fn();

const mockGetGenerativeModel = jest.fn(() => ({
  generateContent: mockGenerateContent,
}));

const mockGoogleGenerativeAI = jest.fn(() => ({
  getGenerativeModel: mockGetGenerativeModel,
}));

// Default: successful response
function setMockSuccess(text = "Mock AI response") {
  mockGenerateContent.mockResolvedValue({
    response: { text: () => text },
  });
}

// Simulate 503 overload
function setMock503() {
  mockGenerateContent.mockRejectedValue(
    new Error("[503] This model is currently experiencing high demand.")
  );
}

// Simulate 429 rate limit
function setMock429() {
  mockGenerateContent.mockRejectedValue(
    new Error("[429] Resource exhausted. Too many requests.")
  );
}

// Simulate invalid API key
function setMockInvalidKey() {
  mockGenerateContent.mockRejectedValue(
    new Error("[400] API key not valid. Please pass a valid API key.")
  );
}

// Simulate network error
function setMockNetworkError() {
  mockGenerateContent.mockRejectedValue(
    new Error("ENOTFOUND generativelanguage.googleapis.com")
  );
}

function resetMocks() {
  mockGenerateContent.mockReset();
  mockGetGenerativeModel.mockClear();
  mockGoogleGenerativeAI.mockClear();
  setMockSuccess(); // default to success
}

module.exports = {
  GoogleGenerativeAI: mockGoogleGenerativeAI,
  mockGenerateContent,
  mockGetGenerativeModel,
  setMockSuccess,
  setMock503,
  setMock429,
  setMockInvalidKey,
  setMockNetworkError,
  resetMocks,
};
