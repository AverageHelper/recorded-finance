<script lang="ts">
	import { Meta, Template, Story } from "@storybook/addon-svelte-csf";
	import Button from "./Button.svelte";
</script>

<Meta
	title="Example/Button"
	component={Button}
	argTypes={{
		backgroundColor: { control: "color" },
		label: { control: "text" },
		onClick: { action: "onClick" },
		primary: { control: "boolean" },
		size: {
			control: { type: "select" },
			options: ["small", "medium", "large"],
		},
	}}
/>

<Template let:args>
	<Button {...args} on:click={args.onClick} />
</Template>

<Story
	name="Primary"
	args={{
		primary: true,
		label: "Button",
	}}
/>

<Story
	name="Secondary"
	args={{
		label: "Button",
	}}
/>

<Story
	name="Large"
	args={{
		size: "large",
		label: "Button",
	}}
/>

<Story
	name="Small"
	args={{
		size: "small",
		label: "Button",
	}}
/>
