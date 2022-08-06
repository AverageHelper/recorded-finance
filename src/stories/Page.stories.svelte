<script lang="ts">
	import type { StoryContext } from "@storybook/addons";
	import { Meta, Template, Story } from "@storybook/addon-svelte-csf";
	import { within, userEvent } from "@storybook/testing-library";
	import Page from "./Page.svelte";

	// More on interaction testing: https://storybook.js.org/docs/svelte/writing-tests/interaction-testing
	function testPlay({ canvasElement }: StoryContext) {
		const canvas = within(canvasElement);
		const loginButton = canvas.getByRole("button", { name: /Log in/i });
		userEvent.click(loginButton);
	}
</script>

<Meta
	title="Example/Page"
	component={Page}
	parameters={{
		// More on Story layout: https://storybook.js.org/docs/svelte/configure/story-layout
		layout: "fullscreen",
	}}
/>

<Template let:args>
	<Page {...args} />
</Template>

<Story name="LoggedOut" args={{}} />

<Story name="LoggedIn" play={testPlay} />
