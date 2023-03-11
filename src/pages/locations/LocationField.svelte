<script lang="ts">
	import type { Coordinate, Location, PendingLocation } from "../../model/Location";
	import { _ } from "../../i18n";
	import { allLocations, locations } from "../../store";
	import { createEventDispatcher, tick } from "svelte";
	import ActionButton from "../../components/buttons/ActionButton.svelte";
	import Fuse from "fuse.js";
	import LocationIcon from "../../icons/Location.svelte";
	import TextField from "../../components/inputs/TextField.svelte";
	import TextIcon from "../../icons/Text.svelte";

	const dispatch = createEventDispatcher<{
		change: PendingLocation | null;
	}>();

	export let value: PendingLocation | null = null;

	let titleField: TextField | undefined;
	let recentsList: HTMLUListElement | undefined;
	let root: HTMLLabelElement | undefined;
	let hasFocus = false;
	let arrowCounter = -1;

	$: {
		hasFocus; // Changed focus
		arrowCounter = -1;
	}

	$: searchClient = new Fuse($allLocations, { keys: ["title", "subtitle"] });
	$: shouldSearch = selectedLocationId === null && newLocationTitle !== "";

	$: recentLocations = shouldSearch
		? searchClient.search(newLocationTitle).map(r => r.item)
		: $allLocations;

	let newLocationTitle = "";
	let newLocationSubtitle = "";
	let newLocationCoordinates: Coordinate | null = null;

	$: selectedLocationId = (value?.id ?? "") || null;
	$: selectedLocation = selectedLocationId !== null ? $locations[selectedLocationId] ?? null : null;

	$: title = newLocationTitle || selectedLocation?.title || "";
	$: subtitle = newLocationSubtitle || selectedLocation?.subtitle || "";
	$: coordinate = newLocationCoordinates ?? selectedLocation?.coordinate ?? null;

	function onKeyDown({ detail: event }: CustomEvent<KeyboardEvent>): void {
		switch (event.code) {
			case "ArrowDown":
				if (arrowCounter < recentLocations.length) {
					arrowCounter += 1;
				}
				break;
			case "ArrowUp":
				if (arrowCounter > 0) {
					arrowCounter -= 1;
				}
				break;
			case "Enter": {
				event.preventDefault();
				if (arrowCounter === -1) {
					arrowCounter = 0; // Default to the first item
				}
				const location = recentLocations[arrowCounter];
				if (location) onLocationSelect(location);
				break;
			}
			// case "Escape": // This no work
			// 	event.preventDefault();
			// 	event.stopPropagation();
			// 	hasFocus = false;
			// 	break;
		}
	}

	async function updateFocusState() {
		await tick(); // Wait until new focus is resolved before we check
		hasFocus = root?.contains(document.activeElement) ?? false;
	}

	async function onLocationSelect(location: Location, event?: KeyboardEvent) {
		// if event is given, make sure space or enter key
		if (event && event.code !== "Enter") return;

		// Inform parent of our selection
		newLocationTitle = "";
		newLocationSubtitle = "";
		newLocationCoordinates = null;
		arrowCounter = -1;
		hasFocus = false;
		await updateModelValue(location);
	}

	function clear(event: CustomEvent<MouseEvent>) {
		event.preventDefault();
		newLocationTitle = "";
		newLocationSubtitle = "";
		newLocationCoordinates = null;
		hasFocus = false;
		arrowCounter = -1;
		dispatch("change", null);
	}

	async function updateModelValue(extantRecord?: Location) {
		await tick();
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
		arrowCounter = -1;
		await updateModelValue();
	}

	async function updateSubtitle(event: CustomEvent<string>) {
		newLocationSubtitle = event.detail;
		arrowCounter = -1;
		await updateModelValue();
	}
</script>

<label
	bind:this={root}
	on:focusin={updateFocusState}
	on:focusout={updateFocusState}
	on:blur={updateFocusState}
>
	<div class="fields{hasFocus ? ' open' : ''}{title || subtitle ? ' plural' : ''}">
		<TextField
			bind:this={titleField}
			value={title}
			label={title ? $_("input.location.title") : $_("input.location.self")}
			placeholder={$_("example.business-name")}
			on:input={updateTitle}
			on:keydown={onKeyDown}
		/>
		{#if title || subtitle}
			<TextField
				value={subtitle}
				label={$_("input.location.subtitle")}
				placeholder={$_("example.city-country")}
				on:input={updateSubtitle}
				on:keydown={onKeyDown}
			/>
		{/if}

		<ul bind:this={recentsList} class={hasFocus ? "" : "hidden"}>
			{#if recentLocations.length > 0}
				<li class="heading">
					<strong>{$_("input.locations.recent")}</strong>
				</li>
			{:else if newLocationTitle}
				<li>{$_("common.no-search-results")}</li>
			{/if}
			{#each recentLocations as location, i (location.id)}
				<li
					class="location{i === arrowCounter ? ' is-active' : ''}"
					on:click={() => onLocationSelect(location)}
					on:keydown={e => onLocationSelect(location, e)}
				>
					{#if location.coordinate}
						<LocationIcon />
					{:else}
						<TextIcon />
					{/if}
					<span>{location.title}</span>
				</li>
			{/each}
		</ul>
	</div>

	{#if !!selectedLocationId || !!title || !!subtitle || !!coordinate}
		<ActionButton kind="info" title={$_("actions.location.clear")} on:click={clear}>
			<span>X</span>
		</ActionButton>
	{/if}
</label>

<style lang="scss">
	@use "styles/colors" as *;

	label {
		width: 100%;
		display: flex;
		flex-flow: row nowrap;
		padding: 0;

		> .fields {
			display: flex;
			flex-flow: column nowrap;
			width: 100%;

			// Remove space between title and subtitle fields
			&.plural :global(.text-field:first-of-type .form-floating) {
				margin-bottom: 0 !important; // because Bootstrap also uses !important, we gotta override
			}

			// Title should not have bottom radius
			&.plural :global(.text-field:first-of-type input),
			&.open :global(.text-field:first-of-type input) {
				border-bottom-left-radius: 0;
				border-bottom-right-radius: 0;
			}

			// Subtitle field should not have top radius or top border
			&.plural :global(.text-field:last-of-type input) {
				border-top-left-radius: 0;
				border-top-right-radius: 0;
				border-top: none;
			}

			// Subtitle field should not have any radius when sandwiched
			&.open.plural :global(.text-field:last-of-type input) {
				border-radius: 0;
			}
		}

		ul {
			list-style: none;
			padding: 0;
			margin-bottom: 14pt;
			margin-top: -12pt;
			max-width: initial;
			width: 100%;
			z-index: 100;
			border-radius: 0 0 0.375rem 0.375rem;
			border: 1pt solid color($separator);
			border-top: none;

			&.hidden {
				// Hide the list, but keep interactive, so that click interactions work
				height: 0;
				opacity: 0;
			}

			> li {
				&.heading {
					padding: 4pt;
					padding-left: 8pt;
					padding-top: 8pt;
				}

				&.location {
					display: block;
					padding: 8pt;
					color: color($label);
					text-decoration: none;
					cursor: pointer;

					&.is-active,
					&:hover {
						background-color: color($fill);
					}
				}
			}
		}

		:global(button) {
			margin: 0 0 8pt 8pt;
			margin-top: 2.3em; // Center between the two fields
			margin-left: 8pt;
			height: 100%;
		}
	}
</style>
