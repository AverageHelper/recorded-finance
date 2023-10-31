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
		environment: "miniflare",
		environmentOptions: {
			bindings: { NODE_ENV: "test" },
		},
		coverage: {
			enabled: true,
			all: true,
			provider: "istanbul",
			reportsDirectory: "coverage",
			exclude: ["scripts/**/*", "vitest.config"],
		},
	},
});
