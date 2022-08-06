<script lang="ts">
	import { ActionButtonKinds, ActionButtonTypes } from "./ActionButton.svelte";
	import { Meta, Template, Story } from "@storybook/addon-svelte-csf";
	import Button from "./ActionButton.svelte";
</script>

<Meta
	title="Buttons/ActionButton"
	component={Button}
	argTypes={{
		label: { control: "text", defaultValue: "Button" },
		disabled: { control: "boolean" },
		type: {
			control: { type: "select" },
			options: ActionButtonTypes,
		},
		kind: {
			control: { type: "select" },
			options: ActionButtonKinds,
		},
		onClick: { action: "onClick" },
		onFocus: { action: "onFocus" },
		onBlur: { action: "onBlur" },
	}}
/>

<Template let:args>
	<Button {...args} on:click={args.onClick} on:focus={args.onFocus} on:blur={args.onBlur}
		>{args.label}</Button
	>
</Template>

<Story name="Plain" />

<Story
	name="Bordered"
	args={{
		kind: "bordered",
	}}
/>

<Story
	name="Destructive"
	args={{
		kind: "bordered-destructive",
	}}
/>
