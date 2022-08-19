<script lang="ts">
	import type { Location } from "../../model/Location";
	import { _ } from "../../i18n";

	export let location: Location;
</script>

<p>{$_("locations.meta.id", { values: { id: location.id } })}</p>
<p>{$_("locations.meta.title", { values: { title: location.title } })}</p>
<p>{$_("locations.meta.subtitle", { values: { subtitle: location.subtitle } })}</p>
<p>{$_("locations.meta.last-used-time", { values: { lastUsed: location.lastUsed } })}</p>
{#if location.coordinate}
	<p>{$_("locations.meta.latitude-short", { values: { lat: location.coordinate.lat } })}</p>
	<p>{$_("locations.meta.longitude-short", { values: { lng: location.coordinate.lng } })}</p>
{/if}
