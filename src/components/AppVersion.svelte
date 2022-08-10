<script lang="ts">
	import { _ } from "../i18n";
	import { loadServerVersion, serverLoadingError, serverVersion } from "../store";
	import { onMount } from "svelte";
	import { version as clientVersion } from "../version";
	import OutLink from "./OutLink.svelte";

	$: isLoading = $serverVersion === "loading" || typeof $serverVersion !== "string";

	onMount(async () => {
		await loadServerVersion();
	});

	const repositoryUrl = `https://github.com/AverageHelper/accountable-svelte/tree/v${clientVersion}`;
</script>

<OutLink to={repositoryUrl} class={$$props["class"]}
	>{$_("common.platform")}
	{$_("common.application")} v{clientVersion},
	{$_("common.server")}
	{#if isLoading}
		<span title={$serverLoadingError?.message}>vX.X.X</span>
	{:else}
		v{$serverVersion}
	{/if}
</OutLink>
