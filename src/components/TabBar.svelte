<script lang="ts">
	import type { Tab } from "../model/ui/tabs";
	import { isAppTab, appTabs as tabs } from "../model/ui/tabs";
	import { useLocation } from "svelte-navigator";
	import TabItem from "./TabItem.svelte";

	const location = useLocation();

	function appTabOrUndefined(tbd: string | undefined): Tab | undefined {
		if (!isAppTab(tbd)) return undefined;
		return tbd;
	}

	$: currentTab = appTabOrUndefined(
		$location.pathname
			.split("/") // split path by delimiters
			.find(s => s !== "")
	); // get first nonempty path segment
</script>

<!-- Portal to corner (?) if mobile width -->
<nav class={$$props["class"]}>
	{#each tabs as tab}
		<TabItem class="item" {tab} isSelected={currentTab === tab} />
	{/each}
</nav>

<style lang="scss">
	@use "styles/colors" as *;

	nav {
		display: flex;
		flex-flow: row nowrap;
		justify-content: center;
		align-items: center;
		overflow-y: scroll;
	}
</style>
