<script lang="ts">
	import type { Tag } from "../../model/Tag";
	import { _ } from "../../i18n";
	import { createEventDispatcher } from "svelte";
	import { numberOfReferencesForTag } from "../../store";
	import ActionButton from "../../components/buttons/ActionButton.svelte";
	import Confirm from "../../components/Confirm.svelte";
	import I18N from "../../components/I18N.svelte";

	const dispatch = createEventDispatcher<{
		yes: Tag;
		no: Tag;
	}>();

	export let tag: Tag;
	export let isOpen: boolean;

	$: count = numberOfReferencesForTag(tag.id);

	function no() {
		dispatch("no", tag);
	}

	function yes() {
		dispatch("yes", tag);
	}
</script>

<Confirm {isOpen} closeModal={no}>
	<span slot="message">
		<I18N keypath="tags.delete.confirm">
			<!-- name -->
			<strong class="tag-name">{tag.name || $_("tags.self-with-unknown-title")}</strong>
		</I18N>
		{#if count > 0}
			<I18N keypath="tags.delete.removed-from-transactions">
				{#if count === 1}
					<strong>{$_("transactions.count.transaction")}</strong>
				{:else}
					<strong>{$_("transactions.count.transactions", { values: { n: count } })}</strong>
				{/if}
			</I18N>
		{/if}
		{$_("tags.delete.action-cannot-be-undone")}</span
	>

	<ActionButton slot="primary-action" kind="destructive" on:click={yes}
		>{$_("common.yes")}</ActionButton
	>
	<ActionButton slot="secondary-action" on:click={no}>{$_("common.no")}</ActionButton>
	<!-- <ActionButton slot="cancel-action" kind="secondary" on:click={no}>{$_("common.cancel")}</ActionButton> -->
</Confirm>

<style lang="scss">
	.tag-name {
		&::before {
			content: "#";
		}
	}
</style>
