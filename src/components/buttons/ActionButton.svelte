<script lang="ts">
	import type { ButtonColor } from "sveltestrap/src/Button";
	import { Button } from "sveltestrap";
	import { createEventDispatcher } from "svelte";

	type ActionButtonType = "button" | "submit" | "reset";
	type ActionButtonKind = "plain" | "info" | "destructive" | "primary" | "secondary";

	const dispatch = createEventDispatcher<{
		click: MouseEvent;
		focus: FocusEvent;
		blur: FocusEvent;
	}>();

	export let type: ActionButtonType = "button";
	export let kind: ActionButtonKind = "primary";
	export let disabled: boolean = false;
	export let title: string | undefined = undefined;

	let color: ButtonColor;
	$: switch (kind) {
		case "info":
			color = "info";
			break;
		case "destructive":
			color = "danger";
			break;
		case "secondary":
			color = "secondary";
			break;
		case "plain":
			color = "link";
			break;
		case "primary":
		default:
			color = "primary";
			break;
	}

	function onClick(event: MouseEvent): void {
		dispatch("click", event);
	}
</script>

<Button class="action-button" {color} {type} {title} {disabled} on:click={onClick}>
	<slot />
</Button>
