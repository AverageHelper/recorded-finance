<script lang="ts">
	import { _, locale } from "../i18n";
	export let title: string;
</script>

<details>
	<summary
		aria-label={$_("actions.more-info-about", {
			values: { topic: title.toLocaleLowerCase($locale.code) },
		})}>{title}</summary
	>
	<aside>
		<slot />
	</aside>
</details>

<style lang="scss">
	@use "styles/colors" as *;

	/* Match the style from before, when we used <NopLink> and {#if} */
	details {
		summary {
			font-weight: bold;
			color: color($link);
			display: block; /* Removes disclosure triangle */

			&:hover {
				text-decoration: underline;
			}

			&::after {
				content: "...";
			}
		}

		&[open] summary::after {
			content: ":";
		}
	}

	aside {
		padding-left: 16pt;
	}
</style>
