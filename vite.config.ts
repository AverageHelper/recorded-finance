import { defineConfig } from "vite";
import { resolve as resolvePath } from "node:path";
import { svelte } from "@sveltejs/vite-plugin-svelte";
import { visualizer } from "rollup-plugin-visualizer";
import analyze from "rollup-plugin-analyzer";
import autoprefixer from "autoprefixer";
import dns from "node:dns";
import env from "vite-plugin-environment";
import sveltePreprocess from "svelte-preprocess";
import tsconfigPaths from "vite-tsconfig-paths";
import typescript from "@rollup/plugin-typescript";

// Open localhost instead of 127.0.0.1. Vite dev server
// runs on localhost, so we want to open client on
// localhost too so that first-party cookies work properly.
// See https://vitejs.dev/config/server-options.html#server-host
dns.setDefaultResultOrder("verbatim");

export default defineConfig({
	plugins: [
		// See https://github.com/ElMassimo/vite-plugin-environment#usage-with-default-values
		env(
			{
				VITE_PLATFORM_SERVER_URL: null, // optional
				VITE_PUBNUB_SUBSCRIBE_KEY: null, // optional
				VITE_ENABLE_LOGIN: "true",
				VITE_ENABLE_SIGNUP: "false",
			},
			{ defineOn: "import.meta.env" }
		),
		svelte({
			emitCss: true,
			preprocess: sveltePreprocess({
				typescript: {
					tsconfigFile: "./tsconfig.prod.json",
				},
			}),
		}),
		typescript({
			// VS Code uses `tsconfig.json` at dev time.
			// Vite uses `tsconfig.prod.json` in production builds:
			tsconfig: resolvePath(__dirname, "./tsconfig.prod.json"),
		}),
		tsconfigPaths({ projects: ["./tsconfig.prod.json"] }),
		analyze({
			onAnalysis: () => {
				// Add a newline before the analysis
				// for vanity
				process.stdout.write("\n");
			},
			filter: module => {
				// Decide which modules are important enough to warn about:
				return (
					// Only modules that themselves take >8% of the bundle
					module.percent > 8
				);
			},
		}),
		visualizer({
			gzipSize: true,
		}),
	],
	// See https://www.npmjs.com/package/svelte-navigator#faq
	optimizeDeps: { exclude: ["svelte-navigator"] },
	resolve: {
		alias: {
			"@": resolvePath(__dirname, "/src"),
			"~bootstrap": "bootstrap",
		},
	},
	css: {
		postcss: {
			plugins: [
				autoprefixer(),
				{
					// Fixes a benign error about charset being improperly placed
					postcssPlugin: "internal:charset-removal",
					AtRule: {
						charset: (atRule): void => {
							if (atRule.name === "charset") {
								atRule.remove();
							}
						},
					},
				},
			],
		},
	},
	test: {
		name: "client",
		globals: true,
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
