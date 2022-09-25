import { defineConfig } from "rollup";
import { nodeResolve } from "@rollup/plugin-node-resolve";
import { terser } from "rollup-plugin-terser";
import { visualizer } from "rollup-plugin-visualizer";
import analyze from "rollup-plugin-analyzer";
import commonjs from "@rollup/plugin-commonjs";
import json from "@rollup/plugin-json";
import typescript from "@rollup/plugin-typescript";

const isProduction = process.env.NODE_ENV === "production";

export default defineConfig({
	plugins: [
		// Transpile source
		typescript({
			project: "./tsconfig.json",
			sourceMap: !isProduction,
		}), // translate TypeScript to JS
		commonjs({ transformMixedEsModules: true }), // translate CommonJS to ESM
		json(), // translate JSON ("express" requires this for its status messages)

		// Find external dependencies
		nodeResolve({
			exportConditions: ["node"],
			preferBuiltins: true,
		}),

		// Minify output
		isProduction ? terser() : null,

		// Statistics
		analyze({ filter: () => false }), // only top-level summary
		visualizer(),
	],
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
		if (
			warning.code === "CIRCULAR_DEPENDENCY" &&
			warning.importer?.includes("readable-stream") === true // Required for "multer"
		)
			return;

		// Ignore "Use of eval is strongly discouraged" warnings from
		// prisma. Their `eval` calls are fairly tame, though this should
		// be audited with each update.
		const evalWhitelist = ["@prisma/client"];
		if (warning.code === "EVAL" && evalWhitelist.some(e => warning.loc?.file?.includes(e))) return;

		defaultHandler(warning);
	},
	input: "./main.ts",
	output: {
		file: "dist/server.js",
		format: "module",
		sourcemap: isProduction ? undefined : "inline",
	},
});
