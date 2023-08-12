import type { PluginOption } from "vite";
import { defineConfig } from "vite";
import { nodeResolve } from "@rollup/plugin-node-resolve";
import { VitePluginNode } from "vite-plugin-node";
import commonjs from "@rollup/plugin-commonjs";
import esbuild from "rollup-plugin-esbuild";
import json from "@rollup/plugin-json";
import replace from "@rollup/plugin-replace";
import typescript from "@rollup/plugin-typescript";
import vercel from "vite-plugin-vercel";

const HOME = process.env["HOME"];

const SINGLE_FILE_BUILD = process.env["SINGLE_FILE_BUILD"] === "true";

export default defineConfig({
	plugins: [
		// Node.js support
		...VitePluginNode({
			adapter: "express",
			appPath: "./main.ts",
			tsCompiler: "esbuild",
		}),

		// Prisma injects my home directory. Remove that:
		HOME !== undefined
			? replace({
					values: {
						[HOME]: "~",
					},
					delimiters: ["", ""],
					preventAssignment: true,
			  })
			: null,

		// Transpile source
		typescript({
			project: "./tsconfig.json",
			sourceMap: false,
		}), // translate TypeScript to JS
		commonjs({ transformMixedEsModules: true }), // translate CommonJS to ESM
		json(), // translate JSON ("express" requires this for its status messages)

		// Find external dependencies
		nodeResolve({
			exportConditions: ["node"],
			preferBuiltins: true,
		}),

		// Minify output
		esbuild({
			minify: true,
			sourceMap: false,
		}),

		// Output Vercel-compatible endpoints (using `_api` dir instead of `api` so Vercel doesn't also do its own compile)
		SINGLE_FILE_BUILD ? null : vercel(), // FIXME: This line puts functions in the correct `functions` folder in output, and sets config.json correctly, but deletes the `static` folder that serves the frontend!
	] as Array<PluginOption>,
	build: {
		rollupOptions: {
			onwarn(warning, defaultHandler) {
				// Ignore "`this` has been rewritten to `undefined`" warnings.
				// They usually relate to modules that were transpiled from
				// TypeScript, and check their context by querying the value
				// of global `this`.
				if (warning.code === "THIS_IS_UNDEFINED") return;

				// Circular dependencies are sometimes bad, but the devs at
				// "readable-stream" insist they're using them correctly.
				// See https://github.com/nodejs/readable-stream/issues/280
				// and https://github.com/nodejs/readable-stream/issues/348
				const circularWhitelist = ["readable-stream"];
				if (
					warning.code === "CIRCULAR_DEPENDENCY" &&
					circularWhitelist.some(
						p => (warning as { importer?: string }).importer?.includes(p) === true
					) // Required for "multer"
				)
					return;

				// Ignore "Use of eval is strongly discouraged" warnings from
				// prisma. Their `eval` calls are fairly tame, though this should
				// be audited with each update.
				const evalWhitelist = ["@prisma/client"];
				if (warning.code === "EVAL" && evalWhitelist.some(e => warning.loc?.file?.includes(e)))
					return;

				defaultHandler(warning);
			},
			// external: ["@prisma/client"], // FIXME: Prisma relies on __dirname, which only works in CJS. Mark as external to run ESM
			external: ["pubnub"],
			input: "./main.ts",
			output: {
				dir: "dist",
				format: "cjs",
			},
		},
		emptyOutDir: false,
		commonjsOptions: { transformMixedEsModules: true },
	},
});
