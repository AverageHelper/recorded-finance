<script lang="ts">
	import type { Attachment } from "../../model/Attachment";
	import { _ } from "../../i18n";
	import { createEventDispatcher } from "svelte";
	import ActionButton from "../../components/buttons/ActionButton.svelte";
	import Confirm from "../../components/Confirm.svelte";
	import I18N from "../../components/I18N.svelte";

	const dispatch = createEventDispatcher<{
		yes: Attachment;
		no: Attachment;
	}>();

	export let file: Attachment | null = null;
	export let isOpen: boolean;

	function no() {
		if (file) {
			dispatch("no", file);
		}
	}

	function yes() {
		if (file) {
			dispatch("yes", file);
		}
	}
</script>

<Confirm {isOpen} closeModal={no}>
	<span slot="message">
		<I18N keypath="files.delete.confirm">
			<!-- title -->
			{#if file}
				<strong>{file.title}</strong>
			{:else}
				<span>{$_("files.self-with-unknown-title")}</span>
			{/if}
		</I18N>
	</span>

	<ActionButton slot="primary-action" kind="bordered-destructive" on:click={yes}
		>{$_("common.yes")}</ActionButton
	>

	<ActionButton slot="secondary-action" kind="bordered-primary" on:click={no}
		>{$_("common.no")}</ActionButton
	>
</Confirm>
