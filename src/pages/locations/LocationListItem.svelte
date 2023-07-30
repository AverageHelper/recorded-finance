<script lang="ts">
	import type { Location } from "../../model/Location";
	import LocationIcon from "../../icons/Location.svelte";
	import TextIcon from "../../icons/Text.svelte";

	export let location: Location;
	export let quote: boolean = false;
</script>

<div class="location" title="id: {location.id}" on:keyup on:click>
	{#if location.coordinate}
		<LocationIcon />
	{:else}
		<TextIcon />
	{/if}
	<span
		>{#if quote}&quot;{/if}{location.title}{#if quote}&quot;{/if}</span
	>
</div>

<style lang="scss">
	@use "styles/colors" as *;

	.location {
		background-color: color($secondary-fill);
		padding: 4pt;
		cursor: pointer;

		@media (hover: hover) {
			&:hover {
				background-color: color($fill);
			}
		}

		:global(.icon) {
			margin-right: 4pt;
		}
	}
</style>
