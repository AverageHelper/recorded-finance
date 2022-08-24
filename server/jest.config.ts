import type { Config } from "@jest/types";

const config: Config.InitialOptions = {
	displayName: "client",
	clearMocks: true,
	preset: "ts-jest/presets/default-esm",
	setupFilesAfterEnv: ["jest-extended/all"],
	testEnvironment: "node",
	moduleNameMapper: {
		"^(\\.{1,2}/.*)\\.js$": "$1",
	},
	testRegex: [".*\\.test\\.(t|j)s$"],
	globals: {
		"ts-jest": {
			tsconfig: "./tsconfig.test.json",
			useESM: true,
		},
	},
	extensionsToTreatAsEsm: [".ts"],
	collectCoverage: true,
	collectCoverageFrom: ["**/*!(.d)!(.test).ts"],
	coverageDirectory: "coverage",
	coveragePathIgnorePatterns: ["/node_modules/", "jest.config"],
	verbose: true,
};

export default config;
