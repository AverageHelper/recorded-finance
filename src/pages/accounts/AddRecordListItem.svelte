<script lang="ts">
	import { _ } from "../../i18n";
	import { createEventDispatcher } from "svelte";
	import ListItem from "../../components/ListItem.svelte";
	import PlusWithCircle from "../../icons/PlusWithCircle.svelte";

	const dispatch = createEventDispatcher<{
		click: MouseEvent;
		keydown: KeyboardEvent;
	}>();

	export let noun: string = "record";

	function onKeydown(event: CustomEvent<KeyboardEvent>) {
		dispatch("keydown", event.detail);
	}

	function onClick(event: CustomEvent<MouseEvent>) {
		event.preventDefault();
		dispatch("click", event.detail);
	}
</script>

<ListItem
	kind="add"
	title={$_("actions.add-new-noun", { values: { noun } })}
	to=""
	on:keydown={onKeydown}
	on:click={onClick}
>
	<PlusWithCircle slot="icon" />
</ListItem>
