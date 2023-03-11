<script lang="ts">
	import type { ColorID } from "../../model/Color";
	import type { InputType } from "sveltestrap/src/Input";
	import { _ } from "../../i18n";
	import { createEventDispatcher } from "svelte";
	import { FormGroup, Input } from "sveltestrap";

	const dispatch = createEventDispatcher<{
		input: string;
		change: string;
		focus: FocusEvent;
		blur: FocusEvent;
		keydown: KeyboardEvent;
		keyup: KeyboardEvent;
		keypress: KeyboardEvent;
	}>();

	/** See https://developer.mozilla.org/en-US/docs/Web/HTML/Attributes/autocomplete */
	type AutocompleteType =
		| "off"
		| "on"
		| "name"
		| "honorific-prefix"
		| "given-name"
		| "additional-name"
		| "family-name"
		| "honorific-suffix"
		| "nickname"
		| "email"
		| "username"
		| "new-password"
		| "current-password"
		| "one-time-code"
		| "organization-title"
		| "organization"
		| "street-address"
		| "address-line1"
		| "address-line2"
		| "address-line3"
		| "address-level4"
		| "address-level3"
		| "address-level2"
		| "address-level1"
		| "country"
		| "country-name"
		| "postal-code"
		| "cc-name"
		| "cc-given-name"
		| "cc-additional-name"
		| "cc-family-name"
		| "cc-number"
		| "cc-exp"
		| "cc-exp-month"
		| "cc-exp-year"
		| "cc-csc"
		| "cc-type"
		| "transaction-currency"
		| "transaction-amount"
		| "language"
		| "bday"
		| "bday-day"
		| "bday-month"
		| "bday-year"
		| "sex"
		| "tel"
		| "tel-country-code"
		| "tel-national"
		| "tel-area-code"
		| "tel-local"
		| "tel-extension"
		| "impp"
		| "url"
		| "photo";

	export let value: string = "";
	export let placeholder: string | null = null;
	export let type: InputType = "text";
	export let size: number = 20;
	export let maxlength: number = 524288;
	export let min: number | null = null;
	export let max: number | null = null;
	export let autocomplete: AutocompleteType = "on";
	export let label: string = "";
	export let disabled: boolean = false;
	export let autocapitalize: string = "none";
	export let spellcheck: boolean | null = null;
	export let required: boolean = false;
	export let showsRequired: boolean = true;
	export let accentColor: ColorID | "label" = "label";
	export let invalid: boolean = false;
	export let valid: boolean = false;
	export let feedback: string | undefined = undefined;

	let root: HTMLDivElement | undefined;
	let input: HTMLInputElement | undefined;

	$: displayLabel = `${label} ${required && showsRequired ? $_("input.required") : ""}`.trim();

	function onInput(event: Event): void {
		const target = event.target as HTMLInputElement | null;
		dispatch("input", target?.value ?? "");
	}

	function onFocus(event: FocusEvent): void {
		dispatch("focus", event);
	}

	function onBlur(event: FocusEvent): void {
		dispatch("blur", event);
	}

	function onChange(event: Pick<InputEvent, "target">): void {
		const target = event.target as HTMLInputElement | null;
		if (target?.value !== value) {
			dispatch("input", target?.value ?? "");
		}
		dispatch("change", target?.value ?? "");
	}

	function onKeyDown(event: KeyboardEvent): void {
		dispatch("keydown", event);
	}

	function onKeyUp(event: KeyboardEvent): void {
		dispatch("keyup", event);
	}

	function onKeyPress(event: KeyboardEvent): void {
		dispatch("keypress", event);
	}

	export function focus(): void {
		input?.focus();
	}

	export function blur(): void {
		input?.blur();
	}

	export function contains(node: Node | null): boolean {
		return root?.contains(node) ?? false;
	}
</script>

<div bind:this={root} class="text-field">
	<FormGroup floating label={displayLabel}>
		<Input
			bind:inner={input}
			class={`accent-color-${accentColor}`}
			{type}
			{size}
			{maxlength}
			{disabled}
			{valid}
			{invalid}
			{feedback}
			min={min ?? undefined}
			max={max ?? undefined}
			{autocomplete}
			placeholder={placeholder || (type === "password" ? "********" : "")}
			{autocapitalize}
			spellcheck={spellcheck ?? type !== "password"}
			{required}
			name={label || placeholder || ""}
			{value}
			on:input={onInput}
			on:blur={onBlur}
			on:focus={onFocus}
			on:change={onChange}
			on:keydown={onKeyDown}
			on:keyup={onKeyUp}
			on:keypress={onKeyPress}
		/>
		<slot slot="label" />
	</FormGroup>
</div>

<style lang="scss" global>
	@use "styles/colors" as *;

	div.text-field {
		width: 100%;
	}

	.form-control,
	.form-control:focus {
		background-color: color($clear);
		color: color($label);
		border-color: color($separator);

		&.accent-color {
			&-red {
				border-color: color($red);
			}
			&-orange {
				border-color: color($orange);
			}
			&-yellow {
				border-color: color($yellow);
			}
			&-green {
				border-color: color($green);
			}
			&-blue {
				border-color: color($blue);
			}
			&-purple {
				border-color: color($purple);
			}
		}
	}
</style>
