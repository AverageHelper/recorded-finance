<script lang="ts">
	import { _, locale } from "../i18n";
	import NopLink from "./NopLink.svelte";

	export let title: string;

	let isOpen = false;

	function toggle() {
		isOpen = !isOpen;
	}
</script>

<NopLink
	bold
	ariaLabel={isOpen
		? null
		: $_("actions.more-info-about", {
				values: { topic: title.toLocaleLowerCase($locale.code) },
		  })}
	on:click={toggle}
	>{title}{#if isOpen}:{:else}...{/if}</NopLink
>

{#if isOpen}
	<aside>
		<slot />
	</aside>
{/if}

<style lang="scss">
	aside {
		padding-left: 16pt;
	}
</style>
