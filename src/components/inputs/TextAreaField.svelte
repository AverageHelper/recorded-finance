<script lang="ts">
	import { FormGroup, Input } from "sveltestrap";
	import { createEventDispatcher } from "svelte";

	const dispatch = createEventDispatcher<{
		input: string;
		focus: FocusEvent;
		blur: Event;
	}>();

	export let value: string = "";
	export let maxlength: number | undefined = undefined;
	export let label: string = "";
	export let disabled: boolean = false;
	export let placeholder: string = "";

	let input: HTMLTextAreaElement | undefined;

	function onInput(event: Event) {
		const target = event.target as HTMLTextAreaElement | null;
		dispatch("input", target?.value);
	}

	export function focus() {
		input?.focus();
	}

	function onFocus(event: FocusEvent) {
		dispatch("focus", event);
	}

	function onBlur(event: Event) {
		dispatch("blur", event);
	}
</script>

<FormGroup floating {label}>
	{#if disabled}
		<Input
			bind:inner={input}
			type="textarea"
			{maxlength}
			value={value || "--"}
			{placeholder}
			readonly={true}
			disabled
		/>
	{:else}
		<Input
			bind:inner={input}
			{value}
			type="textarea"
			{maxlength}
			{placeholder}
			on:input={onInput}
			on:blur={onBlur}
			on:focus={onFocus}
		/>
	{/if}
</FormGroup>

<style lang="scss">
	:global(textarea.form-control) {
		min-height: 10em;
	}
</style>
