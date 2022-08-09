<script lang="ts">
	import { _ } from "../../i18n";
	import { allLocations } from "../../store";
	import List from "../../components/List.svelte";
	import LocationListItem from "./LocationListItem.svelte";

	// FIXME: This somehow stays between login sessions
	$: numberOfLocations = $allLocations.length;
</script>

<main class="content">
	<div class="heading">
		<h1>{$_("locations.list.heading")}</h1>
		<p>{$_("locations.list.how-to-create")}</p>
	</div>

	<List>
		{#each $allLocations as location (location.id)}
			<li>
				<LocationListItem {location} />
			</li>
		{/each}
		{#if numberOfLocations > 0}
			<li>
				<p class="footer"
					>{#if numberOfLocations === 1}{$_("files.count.file")}{:else}{$_("files.count.files", {
							values: { n: numberOfLocations },
						})}{/if}</p
				>
			</li>
		{/if}
	</List>
</main>

<style lang="scss">
	@use "styles/colors" as *;

	.heading {
		max-width: 36em;
		margin: 1em auto;

		> h1 {
			margin: 0;
		}
	}

	.footer {
		color: color($secondary-label);
		user-select: none;
	}
</style>
