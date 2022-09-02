import { defineConfig } from "rollup";
import { nodeResolve } from "@rollup/plugin-node-resolve";
import { terser } from "rollup-plugin-terser";
import { visualizer } from "rollup-plugin-visualizer";
import analyze from "rollup-plugin-analyzer";
import commonjs from "@rollup/plugin-commonjs";
import json from "@rollup/plugin-json";
import typescript from "@rollup/plugin-typescript";

export default defineConfig({
	plugins: [
		// Transpile source
		typescript({ project: "./tsconfig.json" }), // translate TypeScript to JS
		commonjs({ transformMixedEsModules: true }), // translate CommonJS to ESM
		json(), // translate JSON ("express" requires this for its status messages)

		// Find external dependencies
		nodeResolve({
			exportConditions: ["node"],
			preferBuiltins: true,
		}),

		// Minify output
		process.env.NODE_ENV === "production" ? terser() : null,

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

		defaultHandler(warning);
	},
	external: [
		// TODO: See about bundling all of these:

		// "bcrypt" is C++, so can't be bundled directly.
		// Externalizing fixes unresolved "nock", "aws-sdk", and "mock-aws-s3" packages
		"bcrypt",

		// relies on __dirname, so must be external and CJS
		"bufferutil",
		"utf-8-validate",
		"fast-folder-size",

		// Rollup doesn't like these very much:
		"mongoose",
		"multer",
	],
	input: "./main.ts",
	output: {
		file: "dist/server.js",
		format: "module",
	},
});
