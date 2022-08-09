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
	class="add-35efc25c"
	title={$_("actions.add-new-noun", { values: { noun } })}
	to=""
	on:click={onClick}
>
	<PlusWithCircle slot="icon" class="plus" />
</ListItem>

<style lang="scss" global>
	@use "styles/colors" as *;

	.add-35efc25c {
		color: color($green);
		min-height: 44px;

		.plus {
			margin-right: 7pt;
			margin-left: 4pt;
			color: color($green);
		}
	}
</style>
