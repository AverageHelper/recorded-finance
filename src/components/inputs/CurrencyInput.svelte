<script lang="ts">
	import type { Dinero } from "dinero.js";
	import { _, locale } from "../../i18n";
	import { createEventDispatcher } from "svelte";
	import { dinero } from "dinero.js";
	import { toCurrency } from "../../transformers";
	import { USD } from "@dinero.js/currencies";
	import { zeroDinero } from "../../helpers/dineroHelpers";
	import ActionButton from "../buttons/ActionButton.svelte";
	import TextField from "./TextField.svelte";

	const dispatch = createEventDispatcher<{ input: Dinero<number> }>();

	export let label: string | null = null;
	export let value: Dinero<number> = zeroDinero;

	let isIncome = false;

	$: zeroValue = toCurrency($locale.code, zeroDinero, "standard");
	$: presentableValue = toCurrency($locale.code, value, "standard");

	function onInput(event: CustomEvent<string>) {
		const rawValue = event.detail;
		updateValue(rawValue);
	}

	function updateValue(rawValueString: string) {
		const numbersOnly = rawValueString.replace(/\D/gu, "");
		let rawValue = Number.parseInt(numbersOnly, 10);
		if (!isIncome) {
			rawValue = -rawValue;
		}
		if (Number.isNaN(rawValue) || rawValueString === "") {
			dispatch("input", value);
		} else {
			dispatch("input", dinero({ amount: rawValue, currency: USD }));
		}
	}

	function onClick(event: Event) {
		event.preventDefault();
		isIncome = !isIncome;
		updateValue(presentableValue);
	}
</script>

<div class="currency-input">
	<TextField
		class="input"
		label={label ?? undefined}
		value={presentableValue}
		maxlength={18}
		placeholder={zeroValue}
		on:input={onInput}
	/>
	<ActionButton class="negate" kind="info" on:click={onClick}
		>{$_("currency.positive-or-negative")}</ActionButton
	>
</div>

<style lang="scss">
	@use "styles/colors" as *;

	.currency-input {
		display: flex;
		flex-flow: row nowrap;
		align-items: center;
		margin-bottom: 1rem;

		:global(.mb-3.form-floating) {
			margin-bottom: 0 !important; // to override Bootstrap's own !important declaration
		}

		:global(.input) {
			flex-grow: 1;
		}

		:global(button) {
			margin-left: 8pt;
		}
	}
</style>
