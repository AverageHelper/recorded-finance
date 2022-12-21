<script lang="ts">
	import { _ } from "../../i18n";
	import { createEventDispatcher } from "svelte";
	import ListItem from "../../components/ListItem.svelte";
	import PlusWithCircle from "../../icons/PlusWithCircle.svelte";

	const dispatch = createEventDispatcher<{
		click: void;
	}>();

	export let noun: string = "record";

	function onClick(event: Event) {
		event.preventDefault();
		dispatch("click");
	}
</script>

<ListItem
	kind="add"
	title={$_("actions.add-new-noun", { values: { noun } })}
	to=""
	on:click={onClick}
>
	<PlusWithCircle slot="icon" />
</ListItem>
