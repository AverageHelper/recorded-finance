import { defineConfig } from "rollup";
import { nodeResolve } from "@rollup/plugin-node-resolve";
import { terser } from "rollup-plugin-terser";
import { visualizer } from "rollup-plugin-visualizer";
import analyze from "rollup-plugin-analyzer";
import commonjs from "@rollup/plugin-commonjs";
import json from "@rollup/plugin-json";
import replace from "@rollup/plugin-replace";
import typescript from "@rollup/plugin-typescript";

// When we're built using the `--production` flag:
const isProduction = process.env["NODE_ENV"] === "production";

const HOME = process.env["HOME"];

export default defineConfig({
	plugins: [
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
			sourceMap: !isProduction,
		}), // translate TypeScript to JS
		commonjs({ transformMixedEsModules: true }), // translate CommonJS to ESM
		json(), // translate JSON

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

		// Ignore "Use of eval is strongly discouraged" warnings from
		// prisma. Their `eval` calls are fairly tame, though this should
		// be audited with each update.
		const evalWhitelist = ["@prisma/client"];
		if (warning.code === "EVAL" && evalWhitelist.some(e => warning.loc?.file?.includes(e))) return;

		defaultHandler(warning);
	},
	// external: ["@prisma/client"], // FIXME: Prisma relies on __dirname, which only works in CJS. Mark as external to run ESM
	external: ["pubnub"],
	input: "./main.ts",
	output: {
		file: "dist/server.js",
		format: "cjs",
		sourcemap: isProduction ? undefined : "inline",
	},
});
