<script lang="ts">
	import { _ } from "../../i18n";
	import { createEventDispatcher } from "svelte";
	import ListItem from "../../components/ListItem.svelte";
	import PlusWithCircle from "../../icons/PlusWithCircle.svelte";

	const dispatch = createEventDispatcher<{
		click: MouseEvent;
		keyup: KeyboardEvent;
	}>();

	export let noun: string = "record";

	function onClick(event: CustomEvent<MouseEvent> | CustomEvent<KeyboardEvent>) {
		event.preventDefault();
		event.detail.preventDefault();

		if ("key" in event.detail) {
			dispatch("keyup", event.detail);
		} else {
			dispatch("click", event.detail);
		}
	}
</script>

<ListItem
	kind="add"
	title={$_("actions.add-new-noun", { values: { noun } })}
	to=""
	on:keyup={onClick}
	on:click={onClick}
>
	<PlusWithCircle slot="icon" />
</ListItem>
