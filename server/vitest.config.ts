import { defineConfig } from "vitest/config";

export default defineConfig({
	test: {
		name: "server",
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
			provider: "istanbul", // FIXME: v8 should work, but gets confused with some endpoint files
			reportsDirectory: "coverage",
			exclude: ["scripts/**/*", "vitest.config"],
		},
	},
});
