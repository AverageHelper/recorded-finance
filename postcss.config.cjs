// import type { Processor } from "postcss";
// import autoprefixer from "autoprefixer";
const autoprefixer = require("autoprefixer");

// const config: Pick<Processor, "plugins"> = {
module.exports = {
	plugins: [
		autoprefixer(),
		{
			// Fixes a benign error about charset being improperly placed
			postcssPlugin: "internal:charset-removal",
			AtRule: {
				charset: atRule => {
					if (atRule.name === "charset") {
						atRule.remove();
					}
				},
			},
		},
	],
};

// export default config;
