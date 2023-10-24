<script lang="ts">
	import type { SvelteToastOptions } from "@zerodevx/svelte-toast";
	import "./i18n";
	import { onMount } from "svelte";
	import { SvelteToast } from "@zerodevx/svelte-toast";
	import { watchColorScheme } from "./store/uiStore";
	import Router from "./router/Router.svelte";

	const options: SvelteToastOptions = {};

	onMount(watchColorScheme);
</script>

<Router />
<div id="modal" />
<SvelteToast {options} />

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

	main {
		margin: 0;
		margin-bottom: 58pt;
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
