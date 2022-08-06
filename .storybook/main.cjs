module.exports = {
	stories: ["../src/**/*.stories.mdx", "../src/**/*.stories.@(js|jsx|ts|tsx|svelte)"],
	addons: [
		"@storybook/addon-links",
		"@storybook/addon-essentials",
		"@storybook/addon-interactions",
		"@storybook/addon-svelte-csf",
	],
	framework: "@storybook/svelte",
	core: {
		builder: "@storybook/builder-vite",
	},
	svelteOptions: {
		preprocess: require("svelte-preprocess")(),
	},
	features: {
		storyStoreV7: false, // TODO: This should be `true` once SB supports it:
		// See https://github.com/storybookjs/storybook/issues/16673
	},
};
