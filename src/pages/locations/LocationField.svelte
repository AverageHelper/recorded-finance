<script lang="ts">
	import type { Coordinate, Location, PendingLocation } from "../../model/Location";
	import { _ } from "../../i18n";
	import { allLocations, locations } from "../../store";
	import { createEventDispatcher, tick } from "svelte";
	import { location as newLocation } from "../../model/Location";
	import { settingsPath } from "../../router";
	import ActionButton from "../../components/buttons/ActionButton.svelte";
	import Fuse from "fuse.js";
	import LocationListItem from "./LocationListItem.svelte";
	import TextField from "../../components/inputs/TextField.svelte";

	/*
	 * Cases:
	 * - No location (empty text field)
	 * - Location selected (text in field, with an icon, creates an entry if doesn't exist already, updates transaction)
	 * - Modifying selection (text in field, with a different icon)
	 * - Choosing a recent location (hopping through the dropdown)
	 *
	 * Actions:
	 * - Set text as a location
	 * - Set a nearby location as a location
	 * - Clear location
	 */

	const dispatch = createEventDispatcher<{
		change: PendingLocation | null;
	}>();

	export let value: PendingLocation | null = null;

	let titleField: TextField | undefined;
	let recentsList: HTMLUListElement | undefined;
	let hasFocus = false;

	$: searchClient = new Fuse($allLocations, { keys: ["title", "subtitle"] });
	$: shouldSearch = selectedLocationId === null && newLocationTitle !== "";

	$: recentLocations = shouldSearch
		? searchClient.search(newLocationTitle).map(r => r.item)
		: $allLocations;

	let newLocationTitle = "";
	let newLocationSubtitle = "";
	let newLocationCoordinates: Coordinate | null = null;

	$: textLocationPreview = newLocation({
		id: "sample",
		title: newLocationTitle,
		subtitle: null,
		coordinate: null,
		lastUsed: new Date(),
	});

	$: selectedLocationId = (value?.id ?? "") || null;
	$: selectedLocation = selectedLocationId !== null ? $locations[selectedLocationId] ?? null : null;

	$: title = newLocationTitle || selectedLocation?.title || "";
	$: subtitle = newLocationSubtitle || selectedLocation?.subtitle || "";
	$: coordinate = newLocationCoordinates ?? selectedLocation?.coordinate ?? null;

	const settingsRoute = settingsPath();

	async function updateFocusState() {
		await tick(); // Wait until new focus is resolved before we check again
		hasFocus =
			(titleField?.contains(document.activeElement) ?? false) ||
			(recentsList?.contains(document.activeElement) ?? false);
	}

	async function onLocationSelect(location: Location, event?: KeyboardEvent) {
		// if event is given, make sure space or enter key
		if (event && event.code !== "Enter" && event.code !== "Space") return;

		// Inform parent of our selection
		newLocationTitle = "";
		newLocationSubtitle = "";
		newLocationCoordinates = null;
		await tick();
		updateModelValue(location);

		// Hide the recents list for now, since we just got this entry from there
		hasFocus = false;
	}

	function clear(event: CustomEvent<MouseEvent>) {
		event.preventDefault();
		newLocationTitle = "";
		newLocationSubtitle = "";
		newLocationCoordinates = null;
		dispatch("change", null);
	}

	function updateModelValue(extantRecord?: Location) {
		const record: PendingLocation = extantRecord ?? {
			id: null,
			title,
			subtitle,
			coordinate,
			lastUsed: new Date(),
		};
		dispatch("change", record);
	}

	async function updateTitle(event: CustomEvent<string>) {
		newLocationTitle = event.detail;
		await tick();
		updateModelValue();
	}

	async function updateSubtitle(event: CustomEvent<string>) {
		newLocationSubtitle = event.detail;
		await tick();
		updateModelValue();
	}
</script>

<label on:focusin={updateFocusState} on:focusout={updateFocusState} on:blur={updateFocusState}>
	<div class="fields {hasFocus ? 'open' : ''}">
		<TextField
			bind:this={titleField}
			value={title}
			label={title ? $_("input.location.title") : $_("input.location.self")}
			placeholder={$_("example.business-name")}
			on:input={updateTitle}
		/>
		{#if title || subtitle}
			<TextField
				value={subtitle}
				label={$_("input.location.subtitle")}
				placeholder={$_("example.city-country")}
				on:input={updateSubtitle}
			/>
		{/if}
	</div>

	{#if hasFocus}
		<ul bind:this={recentsList}>
			{#if newLocationTitle}
				<li>
					<LocationListItem location={textLocationPreview} quote />
				</li>
			{/if}
			{#if recentLocations.length > 0}
				<li>
					<strong>{$_("input.locations.recent")}</strong>
				</li>
			{/if}
			{#each recentLocations as location (location.id)}
				<li
					on:keyup|stopPropagation|preventDefault={e => onLocationSelect(location, e)}
					on:click|stopPropagation|preventDefault={() => onLocationSelect(location)}
				>
					<LocationListItem {location} />
				</li>
			{/each}
		</ul>
	{/if}

	{#if !!selectedLocationId || !!title || !!subtitle || !!coordinate}
		<ActionButton kind="destructive" title={$_("actions.location.clear")} on:click={clear}>
			<span>X</span>
		</ActionButton>
	{/if}
</label>

<style lang="scss">
	@use "styles/colors" as *;

	label {
		width: 100%;
		display: flex;
		flex-flow: row wrap;
		padding: 0;

		> .fields {
			display: flex;
			flex-flow: column nowrap;
			width: 100%;

			&.open :global(.text-field:last-of-type input) {
				border-bottom-left-radius: 0;
				border-bottom-right-radius: 0;
			}
		}

		ul {
			list-style: none;
			padding: 0;
			margin-bottom: 8pt;
			margin-top: -12pt;
			max-width: initial;
			width: 100%;
			z-index: 100;
			border-radius: 0 0 0.375rem 0.375rem;
			background-color: color($secondary-fill);

			> li {
				padding: 4pt;
			}
		}

		:global(button) {
			margin: 0 0 8pt 8pt;
			margin-top: 1.8em;
			height: 100%;
		}
	}
</style>
