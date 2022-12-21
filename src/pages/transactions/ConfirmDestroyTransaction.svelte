<script lang="ts">
	import type { Transaction } from "../../model/Transaction";
	import { _ } from "../../i18n";
	import { createEventDispatcher } from "svelte";
	import ActionButton from "../../components/buttons/ActionButton.svelte";
	import Confirm from "../../components/Confirm.svelte";
	import I18N from "../../components/I18N.svelte";

	const dispatch = createEventDispatcher<{
		yes: Transaction;
		no: Transaction;
	}>();

	export let transaction: Transaction;
	export let isOpen: boolean;

	function no() {
		dispatch("no", transaction);
	}

	function yes() {
		dispatch("yes", transaction);
	}
</script>

<Confirm {isOpen} closeModal={no}>
	<span slot="message">
		<I18N keypath="transactions.delete.confirm">
			<!-- title -->
			<strong>{transaction.title ?? $_("transactions.self-with-unknown-title")}</strong>
		</I18N>
	</span>

	<ActionButton slot="primary-action" kind="destructive" on:click={yes}
		>{$_("common.yes")}</ActionButton
	>
	<ActionButton slot="secondary-action" on:click={no}>{$_("common.no")}</ActionButton>
	<!-- <ActionButton slot="cancel-action" kind="secondary" on:click={no}>{$_("common.cancel")}</ActionButton> -->
</Confirm>
