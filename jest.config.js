const nextJest = require("next/jest");

const createJestConfig = nextJest({ dir: "./" });

/** @type {import('jest').Config} */
const customJestConfig = {
  // Node, not jsdom: these are logic tests (API envelope, crypto), and
  // jsdom's fetch globals (Request/Response) aren't complete enough for
  // `next/server`. Component tests can opt into jsdom per-file with a
  // `@jest-environment jsdom` docblock when they're added.
  testEnvironment: "node",
  setupFilesAfterEnv: ["<rootDir>/jest.setup.js"],
  moduleNameMapper: {
    "^@/(.*)$": "<rootDir>/$1",
  },
  testPathIgnorePatterns: ["<rootDir>/.next/", "<rootDir>/node_modules/", "<rootDir>/e2e/"],
};

module.exports = createJestConfig(customJestConfig);
