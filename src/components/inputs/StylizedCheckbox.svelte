<script lang="ts">
	import { createEventDispatcher } from "svelte";
	import Spinner from "../Spinner.svelte";

	const dispatch = createEventDispatcher<{ change: boolean }>();

	export let value: boolean;
	export let label: string = "";
	export let loading: boolean = false;
	$: disabled = loading;

	function sendValue(value: boolean): void {
		dispatch("change", value);
	}

	function onChange(event: Event): void {
		if (disabled) return;
		const checkbox = event.target as HTMLInputElement | null;
		sendValue(checkbox?.checked ?? false);
	}

	function toggle() {
		sendValue(!value);
	}

	function onKeyup(event: KeyboardEvent) {
		if (event.key !== " " && event.key !== "Spacebar") return;
		toggle();
	}
</script>

<div style="position: relative;">
	<label
		class="checkbox {loading ? 'loading' : ''}"
		tabindex="0"
		on:keyup|stopPropagation|preventDefault={onKeyup}
	>
		<input type="checkbox" checked={value} {disabled} on:change={onChange} />
		<label
			class="mark {disabled ? 'disabled' : ''}"
			on:click|stopPropagation|preventDefault={toggle}
		/>
		{#if label}
			<span class="label {disabled ? 'disabled' : ''}">{label}</span>
		{/if}
	</label>
	{#if loading}
		<div class="spinner">
			<Spinner />
		</div>
	{/if}
</div>

<style lang="scss">
	@use "styles/colors" as *;

	.spinner {
		position: absolute;
		top: 50%;
		left: 50%;
		transform: translate(-75%, -35%);
	}

	.checkbox {
		position: relative;
		display: flex;
		align-items: center;
		justify-content: flex-start;
		min-height: 33pt;
		cursor: pointer;

		&.loading {
			opacity: 0;
		}

		.mark {
			position: relative;
			margin: 0;
			margin-top: 0.2em;
			margin-right: 0.4em;
			width: 1.8em;
			height: 1.8em;
			border-radius: 0.4em;
			border: 2pt solid color($transparent-gray);
			background-color: color($clear);
			cursor: pointer;
			transition: all 0.1s ease;

			&.disabled {
				cursor: default;
				color: color($secondary-label);
				background: color($secondary-fill);
			}

			&:after {
				content: "";
				width: 0.9em;
				height: 0.35em;
				position: absolute;
				top: 0.45em;
				left: 0.3em;
				border: 0.3em solid color($label);
				border-top: none;
				border-right: none;
				background: transparent;
				opacity: 0;
				transform: rotate(-45deg);
				transition: all 0.1s ease;
			}
		}

		.label {
			text-align: left;
			user-select: none;

			&.disabled {
				color: color($secondary-label);
			}
		}

		input {
			visibility: hidden;
			position: absolute;

			&:checked + label {
				border-color: color($label);

				&:after {
					opacity: 1;
				}
			}

			&:checked:disabled {
				background: color($secondary-fill);
				border-color: color($secondary-fill);
			}

			&:disabled + label {
				background: color($secondary-fill);
				border-color: color($secondary-fill);
			}
		}
	}
</style>
