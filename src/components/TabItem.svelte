<script lang="ts">
	import type { Tab } from "../model/ui/tabs";
	import { _ } from "../i18n";
	import { labelIdForTab, routeForTab } from "../model/ui/tabs";
	import { link } from "svelte-navigator";

	export let tab: Tab;
	export let isSelected: boolean = false;

	$: href = routeForTab(tab);
	$: labelId = labelIdForTab(tab);
</script>

<a class="item-container {isSelected ? 'selected' : ''} {$$props['class']}" {href} use:link
	>{$_(labelId)}
	{#if isSelected}
		<span class="visually-hidden">{$_("common.current-aside")}</span>
	{/if}</a
>

<style lang="scss">
	@use "styles/colors" as *;

	.item-container {
		display: flex;
		align-items: center;
		min-height: 3em;
		height: 100%;
		padding: 0 1em;
		font-weight: bold;
		text-decoration: none;
		background-color: color($navbar-background);
		color: color($label);

		&.selected {
			border-bottom: 2pt solid color($label);
		}

		@media (hover: hover) {
			&:hover {
				background: color($secondary-overlay);
				text-decoration: none;
			}
		}
	}
</style>
