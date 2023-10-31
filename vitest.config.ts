import { defineConfig } from "vitest/config";

export default defineConfig({
	test: {
		name: "client",
		typecheck: {
			checker: "tsc",
			tsconfig: "./tsconfig.test.json",
		},
		mockReset: true,
		clearMocks: true,
		setupFiles: ["./vitestSetup.ts"],
		environment: "node",
		exclude: ["node_modules", "server", "dist"],
		coverage: {
			enabled: true,
			all: true,
			provider: "istanbul",
			reportsDirectory: "coverage",
			exclude: ["scripts/**/*", "vitest.config", "server"],
		},
	},
});
