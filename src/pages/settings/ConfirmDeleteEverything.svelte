<script lang="ts">
	import { _ } from "../../i18n";
	import { createEventDispatcher } from "svelte";
	import ActionButton from "../../components/buttons/ActionButton.svelte";
	import Confirm from "../../components/Confirm.svelte";
	import I18N from "../../components/I18N.svelte";

	const dispatch = createEventDispatcher<{
		yes: void;
		no: void;
	}>();

	export let isOpen: boolean;

	function no() {
		dispatch("no");
	}

	function yes() {
		dispatch("yes");
	}
</script>

<Confirm {isOpen} closeModal={no}>
	<span slot="message">
		<I18N keypath="settings.delete-all.confirm">
			<!-- everything -->
			<strong>{$_("settings.delete-all.really-everything")}</strong>
		</I18N>
	</span>

	<ActionButton slot="primary-action" kind="bordered-destructive" on:click={yes}
		>{$_("common.yes")}</ActionButton
	>
	<ActionButton slot="secondary-action" kind="bordered-primary" on:click={no}
		>{$_("common.no")}</ActionButton
	>
</Confirm>
