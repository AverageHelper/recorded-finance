import { defineConfig } from "vitest/config";

export default defineConfig({
	test: {
		name: "server",
		globals: true,
		typecheck: {
			checker: "tsc",
			tsconfig: "./tsconfig.test.json",
		},
		mockReset: true,
		clearMocks: true,
		setupFiles: ["./vitestSetup.ts"],
		environment: "node",
		coverage: {
			enabled: true,
			all: true,
			provider: "istanbul",
			reportsDirectory: "coverage",
			exclude: ["scripts/**/*", "vitest.config"],
		},
	},
});
