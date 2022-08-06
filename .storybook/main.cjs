// const { mergeConfig } = require("vite");
const sveltePreprocess = require("svelte-preprocess");

module.exports = {
	stories: ["../src/**/*.stories.mdx", "../src/**/*.stories.@(js|jsx|ts|tsx|svelte)"],
	addons: [
		"storybook-dark-mode",
		"@storybook/addon-links",
		"@storybook/addon-essentials",
		"@storybook/addon-interactions",
		"@storybook/addon-svelte-csf",
		{
			name: "storybook-addon-sass-postcss",
			options: {
				// postcssLoaderOptions: {
				// 	implementation: require("postcss"),
				// },
				sassLoaderOptions: {
					implementation: require("sass"),
				},
				rule: {
					test: /\.(scss|sass)$/i,
				},
			},
		},
	],
	framework: "@storybook/svelte",
	core: {
		builder: "@storybook/builder-vite",
	},
	// async viteFinal(config) {
	// 	// Merge custom configuration into Storybook's default config
	// 	const prodConfig = (await import("../vite.config.ts")).default;
	// 	return mergeConfig(config, prodConfig);
	// },
	svelteOptions: {
		preprocess: sveltePreprocess(),
		// preprocess: sveltePreprocess({
		// 	typescript: {
		// 		tsconfigFile: "./tsconfig.json",
		// 	},
		// }),
	},
	features: {
		storyStoreV7: false, // TODO: This should be `true` once SB supports it:
		// See https://github.com/storybookjs/storybook/issues/16673
	},
};
