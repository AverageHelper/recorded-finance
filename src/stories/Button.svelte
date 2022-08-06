<script lang="ts">
	import "./button.css";
	import { createEventDispatcher } from "svelte";

	type ButtonSize = "large" | "small" | "medium";

	/**
	 * Is this the principal call to action on the page?
	 */
	export let primary = false;

	/**
	 * What background color to use
	 */
	export let backgroundColor = "";

	/**
	 * How large should the button be?
	 */
	export let size: ButtonSize = "medium";

	/**
	 * Button contents
	 */
	export let label = "";

	$: mode = primary ? "storybook-button--primary" : "storybook-button--secondary";

	$: style = backgroundColor ? `background-color: ${backgroundColor}` : "";

	const dispatch = createEventDispatcher<{
		click: MouseEvent;
	}>();

	/**
	 * Optional click handler
	 */
	function onClick(event: MouseEvent) {
		dispatch("click", event);
	}
</script>

<button
	type="button"
	class={["storybook-button", `storybook-button--${size}`, mode].join(" ")}
	{style}
	on:click={onClick}
>
	{label}
</button>
