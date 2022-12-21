<script lang="ts">
	import { createEventDispatcher } from "svelte";
	import { FormGroup, Input } from "sveltestrap";

	const dispatch = createEventDispatcher<{ change: boolean }>();

	export let value: boolean;
	export let disabled: boolean = false;
	export let label: string = "";

	function sendValue(value: boolean): void {
		dispatch("change", value);
	}

	function onChange(event: Event): void {
		if (disabled) return;
		const checkbox = event.target as HTMLInputElement | null;
		sendValue(checkbox?.checked ?? false);
	}
</script>

<FormGroup class="checkbox">
	<Input type="checkbox" {label} checked={value} {disabled} on:change={onChange} />
</FormGroup>
