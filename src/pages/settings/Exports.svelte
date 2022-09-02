<script lang="ts">
	import { _ } from "../../i18n";
	import { compressUserData, handleError } from "../../store";
	import { downloadFileAtUrl } from "../../transport";
	import ActionButton from "../../components/buttons/ActionButton.svelte";
	import I18N from "../../components/I18N.svelte";

	let isLoading = false;

	async function downloadStuff(event: Event, shouldMinify: boolean) {
		event.preventDefault();
		isLoading = true;

		try {
			const dataUri = await compressUserData(shouldMinify);
			downloadFileAtUrl(dataUri, "accountable.zip");
		} catch (error) {
			handleError(error);
		} finally {
			isLoading = false;
		}
	}
</script>

<form on:submit|preventDefault>
	<h3>{$_("settings.export.meta.heading")}</h3>
	<p>
		<I18N keypath="settings.export.meta.description">
			<!-- unencrypted -->
			<strong>{$_("settings.export.meta.unencrypted")}</strong>
		</I18N>
	</p>
	{#if false}
		<!-- TODO: I18N -->
		<p
			>This export might get big, and about 1/3 of it is spacing to make the JSON more
			human-readable. If you don't care about that, then we can just export the raw JSON data as
			small as we can make it.</p
		>
	{/if}
	<div class="buttons-6933f502">
		<ActionButton kind="bordered" disabled={isLoading} on:click={e => downloadStuff(e, false)}
			>{$_("settings.export.actions.export-all")}</ActionButton
		>
		{#if false}
			<ActionButton kind="bordered" disabled={isLoading} on:click={e => downloadStuff(e, true)}
				>{$_("settings.export.actions.export-all")}</ActionButton
			>
			<ActionButton kind="bordered" disabled={isLoading} on:click={e => downloadStuff(e, false)}
				>{$_("settings.export.actions.export-all-nicely")}</ActionButton
			>
		{/if}
	</div>
</form>

<style lang="scss" global>
	p {
		margin-bottom: 0;
	}

	.buttons-6933f502 {
		display: flex;
		flex-flow: row wrap;

		:not(:last-child) {
			margin-right: 8pt;
		}
	}
</style>
