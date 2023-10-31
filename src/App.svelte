<script lang="ts">
	import type { SvelteToastOptions } from "@zerodevx/svelte-toast";
	import "./i18n";
	import { onMount } from "svelte";
	import { SvelteToast } from "@zerodevx/svelte-toast";
	import { watchColorScheme } from "./store/uiStore";
	import Footer from "./Footer.svelte";
	import Router from "./router/Router.svelte";

	const options: SvelteToastOptions = {};

	onMount(watchColorScheme);
</script>

<div class="wrapper">
	<Router />
	<div id="modal" />
	<SvelteToast {options} />

	<Footer />
</div>

<style lang="scss" global>
	@use "styles/colors" as *;
	@import "styles/setup";

	#app * {
		box-sizing: border-box;
	}

	html,
	body {
		padding: 0;
		margin: 0;
	}

	.wrapper {
		position: relative;
		height: 100%;
		display: flex;
		flex-flow: column nowrap;
	}

	main {
		margin: 0;
		flex-grow: 1;
	}

	a {
		color: color($link);

		@media (hover: hover) {
			&:hover {
				color: color($link-hover);
			}
		}
	}

	// Toasts
	:root {
		.toast-success {
			--toastBackground: var(--alert-success);
			--toastBarBackground: var(--green);
		}

		.toast-error {
			// FIXME: Should use color() here but didn't work before
			--toastBackground: var(--alert-failure);
			--toastBarBackground: var(--white);
		}
	}
</style>
