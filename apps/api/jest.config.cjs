/** @type {import("jest").Config} */
module.exports = {
  rootDir: "src",
  testEnvironment: "node",
  clearMocks: true,
  moduleFileExtensions: ["ts", "js", "json"],
  testRegex: ".*\\.spec\\.ts$",
  transform: {
    "^.+\\.ts$": [
      "ts-jest",
      {
        tsconfig: "<rootDir>/../tsconfig.spec.json",
      },
    ],
  },
};
