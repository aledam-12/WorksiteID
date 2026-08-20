/** @type {import('jest').Config} */
module.exports = {
  preset: "ts-jest",
  testEnvironment: "node",

  roots: ["<rootDir>/tests"],

  testMatch: ["**/*.test.ts"],

  transform: {
    "^.+\\.ts$": [
      "ts-jest",
      {
        tsconfig: "<rootDir>/tsconfig.test.json",
      },
    ],
  },

  moduleFileExtensions: ["ts", "js", "json"],

  collectCoverageFrom: ["backend/src/**/*.ts"],

  coverageDirectory: "<rootDir>/coverage",

  clearMocks: true,
};
