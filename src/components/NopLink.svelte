<script lang="ts">
	/** Defines a string value that labels the current element. */
	export let ariaLabel: string | null = null;

	/** Use a bold font weight. */
	export let bold: boolean = false;

	/** Use a white text color. */
	export let white: boolean = false;
</script>

<!-- svelte-ignore a11y-invalid-attribute -->
<a
	href="#"
	class="{bold ? 'bold' : ''} {white ? 'white' : ''}"
	aria-label={ariaLabel || null}
	on:click|preventDefault
>
	<slot />
</a>

<style lang="scss">
	@use "styles/colors" as *;

	.bold {
		font-weight: bold;
	}

	.white {
		color: color($white);
	}
</style>
