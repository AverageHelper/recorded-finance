<script lang="ts">
	import type { ButtonColor } from "sveltestrap/src/Button";
	import { Button } from "sveltestrap";
	import { createEventDispatcher } from "svelte";
	import { preferredColorScheme } from "store";

	type ActionButtonType = "button" | "submit" | "reset";
	type ActionButtonKind =
		| "plain"
		| "bordered"
		| "bordered-destructive"
		| "bordered-primary"
		| "bordered-primary-green"
		| "bordered-secondary";

	const dispatch = createEventDispatcher<{
		click: MouseEvent;
		focus: FocusEvent;
		blur: FocusEvent;
	}>();

	export let type: ActionButtonType = "button";
	export let kind: ActionButtonKind = "plain";
	export let disabled: boolean = false;

	let color: ButtonColor;
	$: switch (kind) {
		case "bordered":
		case "bordered-destructive":
		case "bordered-primary":
			color = "primary";
			break;
		case "bordered-primary-green":
			color = "success";
			break;
		case "bordered-secondary":
			color = "secondary";
			break;
		case "plain": {
			if ($preferredColorScheme === "dark") {
				color = "light";
			} else {
				color = "dark";
			}
			break;
		}
	}

	function onClick(event: MouseEvent): void {
		dispatch("click", event);
	}
</script>

<Button class={`kind--${kind} ${$$props["class"]}`} {color} {type} {disabled} on:click={onClick}>
	<slot />
</Button>
