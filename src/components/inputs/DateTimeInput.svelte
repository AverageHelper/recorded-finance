<script lang="ts">
	import { _ } from "../../i18n";
	import { createEventDispatcher } from "svelte";
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

<div class="date-input-9992f6dc">
	<label class="text-input__container">
		<div class="text-input__label">{label}</div>
		<input
			class="text-input text-input--has-value"
			type="datetime-local"
			{pattern}
			max={stringFormattedDate(max)}
			min={stringFormattedDate(min)}
			value={stringFormattedDate(value)}
			on:input={onDateUpdated}
		/>
	</label>
	<ActionButton kind="bordered" on:click={reset}>{$_("date-time.now")}</ActionButton>
</div>

<style lang="scss" global>
	@use "styles/colors" as *;

	.date-input-9992f6dc {
		display: flex;
		flex-flow: row nowrap;
		align-items: flex-end;

		button {
			padding: 0.4em 0;
			margin: 0.6em 0;
			margin-left: 1em;
			width: fit-content;
		}

		.text-input {
			display: block;
			border: 0;
			border-bottom: 2px solid color($gray5);
			background-color: color($input-background);
			padding: 0.5em;
			width: 100%;
			font-size: 1em;
			text-overflow: ellipsis;
			transition: all 0.2s ease;
			box-sizing: border-box;

			&::placeholder {
				color: color($secondary-label);
			}

			&__container {
				display: block;
				padding: 0.6em 0;
				width: 100%;
			}

			&__label {
				display: block;
				color: color($blue);
				user-select: none;
				font-weight: 700;
				font-size: 0.9em;
				width: 100%;
			}

			&:focus,
			&:focus-within,
			&.text-input--has-value {
				outline: none;
			}
			&:focus,
			&:focus-within {
				border-bottom-color: color($blue);
			}

			&:disabled {
				background-color: inherit;
				opacity: 0.7;

				& ~ .text-input__label {
					opacity: 0.7;
				}
			}
		}
	}
</style>
