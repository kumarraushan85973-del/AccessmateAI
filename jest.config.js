module.exports = {
  testEnvironment: "node",
  testMatch: [
    "**/tests/**/*.test.js"
  ],
  collectCoverageFrom: [
    "server.js",
    "!node_modules/**"
  ],
  coverageDirectory: "coverage",
  coverageReporters: ["text", "text-summary", "html"],
  coverageThreshold: {
    global: {
      branches: 60,
      functions: 70,
      lines: 70,
      statements: 70
    }
  },
  verbose: true,
  testTimeout: 15000
};
