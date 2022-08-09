<script lang="ts">
	import type { LocationPref } from "../../transport";
	import { _ } from "../../i18n";
	import { handleError } from "../../store";
	import { locationPrefs as sensitivityOptions } from "../../transport";
	import { onMount } from "svelte";
	import { preferences, updateUserPreferences } from "../../store/authStore";
	import { toast } from "@zerodevx/svelte-toast";
	import ActionButton from "../../components/buttons/ActionButton.svelte";
	import Checkmark from "../../icons/Checkmark.svelte";
	import I18N from "../../components/I18N.svelte";
	import OutLink from "../../components/OutLink.svelte";

	let isLoading = false;
	$: currentSensitivity = $preferences.locationSensitivity;
	let selectedSensitivity: LocationPref = "none";

	$: hasChanges = selectedSensitivity !== currentSensitivity;

	function reset(event?: Event) {
		event?.preventDefault();
		selectedSensitivity = currentSensitivity;
	}

	onMount(() => {
		reset();
	});

	// For some reason, we keep resetting `selectedSensitivity` to "none" when the preference changes.
	// This should fix that.
	$: currentSensitivity && reset();

	async function submitNewLocationPref() {
		try {
			if (!sensitivityOptions.includes(selectedSensitivity)) {
				throw new Error(
					$_("error.settings.invalid-location-preference", {
						values: { pref: selectedSensitivity },
					})
				);
			}

			isLoading = true;

			await updateUserPreferences({
				locationSensitivity: selectedSensitivity,
			});
			toast.push($_("settings.update-successful"), { classes: ["toast-success"] });
			reset();
		} catch (error) {
			handleError(error);
		}
		isLoading = false;
	}
</script>

<form on:submit|preventDefault={submitNewLocationPref}>
	<h3>{$_("settings.location.heading")}</h3>
	<p>{$_("settings.location.api-disclaimer")}</p>

	<div class="options-b0a38164">
		{#each sensitivityOptions as option}
			<ActionButton
				class="option"
				kind="bordered"
				on:click={e => {
					e.preventDefault();
					selectedSensitivity = option;
				}}
			>
				{#if option === selectedSensitivity}
					<div class="selected">
						<Checkmark />
					</div>
				{:else}
					<div class="not-selected" />
				{/if}

				<div class="option-details">
					{#if option === "none"}
						<span>{$_("settings.location.preference.none")}</span>
					{:else if option === "vague"}
						<span>{$_("settings.location.preference.imprecise")}</span>
					{:else if option === "specific"}
						<span>{$_("settings.location.preference.precise")}</span>
					{/if}

					{#if option === "none"}
						<p>{$_("settings.location.preference.none-description")}</p>
					{:else if option === "vague"}
						<p>{$_("settings.location.preference.imprecise-description")}</p>
					{:else if option === "specific"}
						<p>{$_("settings.location.preference.precise-description")}</p>
					{/if}
				</div>
			</ActionButton>
		{/each}
	</div>
	<p style="font-size: small">
		<I18N keypath="settings.location.manual-disclaimer">
			<!-- iplocate -->
			<OutLink to="https://www.iplocate.io">{$_("settings.location.iplocate")}</OutLink>
		</I18N>
	</p>

	<div class="buttons">
		<ActionButton type="submit" kind="bordered-primary" disabled={!hasChanges || isLoading}
			>{$_("settings.location.actions.confirm")}</ActionButton
		>
		{#if hasChanges}
			<ActionButton kind="bordered" disabled={isLoading} on:click={reset}
				>{$_("common.reset")}</ActionButton
			>
		{/if}
	</div>
</form>

<style lang="scss" global>
	@use "styles/colors" as *;

	.options-b0a38164 {
		.option {
			display: flex;
			flex-flow: row nowrap;
			align-items: center;
			width: 100%;
			margin: 0;

			&:not(:last-child) {
				margin-bottom: 8pt;
			}

			&-details {
				display: flex;
				flex-flow: column nowrap;
				justify-content: flex-start;
				text-align: left;

				> span {
					margin-top: 8pt;
				}

				> p {
					margin: 4pt 8pt;
					margin-bottom: 8pt;
					color: color($secondary-label);
				}
			}

			.selected {
				min-width: 22pt;
				width: 22pt;
				height: 22pt;
				display: flex;
				align-items: center;
				justify-content: center;
			}

			.not-selected {
				min-width: 22pt;
				width: 22pt;
				height: 22pt;
				border-radius: 50%;
				border: 2pt solid color($gray);
			}

			span {
				margin-left: 8pt;
			}
		}
	}

	.buttons {
		display: flex;
		flex-flow: row nowrap;

		:not(:last-child) {
			margin-right: 8pt;
		}
	}
</style>
