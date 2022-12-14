<script lang="ts">
	import { _ } from "../../i18n";
	import { createEventDispatcher } from "svelte";
	import { FormGroup, Input } from "sveltestrap";
	import { stringFormattedDate } from "../../transformers/stringFormattedDate";
	import ActionButton from "../buttons/ActionButton.svelte";

	const dispatch = createEventDispatcher<{ input: Date }>();

	const pattern = `[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}`;

	const currentDate = new Date();
	currentDate.setSeconds(0, 0); // reset to top of current minute

	export let value: Date = currentDate;
	export let label: string = "";
	export let min: Date | null = null;
	export let max: Date | null = null;

	function reset(event: Event) {
		event.preventDefault();
		const newDate = new Date();
		newDate.setSeconds(0, 0);
		dispatch("input", newDate);
	}

	function onDateUpdated(event: Event) {
		const target = event.target as HTMLInputElement | null;
		const date = !target ? null : new Date(target.value);
		if (date) dispatch("input", date);
	}
</script>

<div class="date-input">
	<FormGroup floating {label}>
		<Input
			type="datetime-local"
			{pattern}
			max={stringFormattedDate(max)}
			min={stringFormattedDate(min)}
			value={stringFormattedDate(value)}
			on:input={onDateUpdated}
		/>
	</FormGroup>
	<ActionButton kind="info" on:click={reset}>{$_("date-time.now")}</ActionButton>
</div>

<style lang="scss">
	@use "styles/colors" as *;

	.date-input {
		display: flex;
		flex-flow: row nowrap;
		align-items: center;
		margin-bottom: 1rem;

		:global(.mb-3.form-floating) {
			margin-bottom: 0 !important; // to override Bootstrap's own !important declaration
			flex-grow: 1;
		}

		:global(button) {
			margin-left: 8pt;
		}
	}
</style>
