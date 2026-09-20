/** @type {import('jest').Config} */
module.exports = {
  preset: "ts-jest",
  testEnvironment: "node",

  roots: ["<rootDir>/tests"],

  testMatch: ["<rootDir>/tests/integration/**/*.test.ts"],

  transform: {
    "^.+\\.ts$": [
      "ts-jest",
      {
        tsconfig: "<rootDir>/tsconfig.test.json",
      },
    ],
  },

  moduleFileExtensions: ["ts", "js", "json"],

  moduleNameMapper: {
    "^(\\.{1,2}/.*)\\.js$": "$1",
  },

  collectCoverageFrom: ["backend/src/**/*.ts"],

  coverageDirectory: "<rootDir>/coverage",

  clearMocks: true,

  forceExit: true,

  testTimeout: 30000,
};
