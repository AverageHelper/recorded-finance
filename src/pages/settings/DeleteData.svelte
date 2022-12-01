<script lang="ts">
	import { _ } from "../../i18n";
	import { accountId, destroyVault, handleError } from "../../store";
	import { logoutPath } from "../../router";
	import { useNavigate } from "svelte-navigator";
	import ActionButton from "../../components/buttons/ActionButton.svelte";
	import ConfirmDeleteEverything from "./ConfirmDeleteEverything.svelte";
	import Form from "../../components/Form.svelte";
	import I18N from "../../components/I18N.svelte";
	import TextField from "../../components/inputs/TextField.svelte";

	const navigate = useNavigate();

	let password = "";
	let isAskingToDelete = false;
	let isDeleting = false;

	$: hasChanges = password !== "";

	function reset(event: Event) {
		event.preventDefault();
		password = "";
	}

	function askToDeleteEverything() {
		isAskingToDelete = true;
	}

	async function confirmDeleteEverything() {
		isAskingToDelete = false;
		isDeleting = true;

		try {
			if (!password) throw new Error($_("error.form.missing-required-fields"));
			await destroyVault(password);

			navigate(logoutPath());
		} catch (error) {
			handleError(error);
			isDeleting = false;
		}
	}

	function cancelDeleteEverything() {
		isAskingToDelete = false;
	}
</script>

<Form on:submit={askToDeleteEverything}>
	<h3>{$_("settings.delete-all.heading")}</h3>
	<p>
		<I18N keypath="settings.delete-all.description">
			<!-- platform -->
			<span>{$_("common.platform")}</span>
		</I18N>
	</p>

	<TextField
		value={$accountId ?? $_("example.account-id")}
		type="text"
		label={$_("login.account-id")}
		disabled
	/>
	<TextField
		value={password}
		on:input={e => (password = e.detail)}
		type="password"
		label={$_("login.current-passphrase")}
		autocomplete="current-password"
		showsRequired={false}
		required
	/>

	<div class="buttons-5655e1fc">
		<ActionButton type="submit" kind="bordered-destructive" disabled={!hasChanges || isDeleting}>
			{#if isDeleting}
				<span>{$_("settings.delete-all.in-progress")}</span>
			{:else}
				<span>{$_("settings.delete-all.start-imperative")}</span>
			{/if}
		</ActionButton>
		{#if hasChanges}
			<ActionButton kind="bordered" disabled={isDeleting} on:click={reset}
				>{$_("common.reset")}</ActionButton
			>
		{/if}
	</div>
</Form>

<ConfirmDeleteEverything
	isOpen={isAskingToDelete}
	on:yes={confirmDeleteEverything}
	on:no={cancelDeleteEverything}
/>

<style lang="scss" global>
	.buttons-5655e1fc {
		display: flex;
		flex-flow: row nowrap;

		:not(:last-child) {
			margin-right: 8pt;
		}
	}
</style>
