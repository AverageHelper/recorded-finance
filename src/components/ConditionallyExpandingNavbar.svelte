<script lang="ts">
	/**
	 * This component exists because sveltestrap's `Navbar` component
	 * doesn't properly react to changes to the `expand` prop.
	 */

	import { Navbar } from "sveltestrap";

	export let expand: boolean;
</script>

{#if expand}
	<Navbar expand="md">
		<slot />
	</Navbar>
{:else}
	<Navbar>
		<slot />
	</Navbar>
{/if}
