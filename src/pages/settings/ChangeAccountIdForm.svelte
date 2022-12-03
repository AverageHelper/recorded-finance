<script lang="ts">
	import { _ } from "../../i18n";
	import { accountId, regenerateAccountId as _regenerateAccountId } from "../../store/authStore";
	import { handleError } from "../../store";
	import { toast } from "@zerodevx/svelte-toast";
	import ActionButton from "../../components/buttons/ActionButton.svelte";
	import Form from "../../components/Form.svelte";
	import NewLoginModal from "../../components/NewLoginModal.svelte";
	import TextField from "../../components/inputs/TextField.svelte";

	let isLoading = false;
	let currentPassword = "";

	$: hasChanges = currentPassword !== "";

	function reset(event?: Event) {
		event?.preventDefault();
		currentPassword = "";
	}

	async function regenerateAccountId() {
		try {
			if (!currentPassword) {
				throw new Error($_("error.form.missing-required-fields"));
			}

			isLoading = true;

			await _regenerateAccountId(currentPassword);
			toast.push($_("settings.auth.account-id-updated"), { classes: ["toast-success"] });
			reset();
		} catch (error) {
			handleError(error);
		}
		isLoading = false;
	}
</script>

<Form on:submit={regenerateAccountId}>
	<h3>{$_("settings.auth.account-id-heading")}</h3>
	<p>{$_("settings.auth.account-id-description")}</p>
	<TextField
		value={$accountId ?? $_("example.account-id")}
		type="text"
		label={$_("login.current-account-id")}
		disabled
	/>
	<TextField
		value={currentPassword}
		on:input={e => (currentPassword = e.detail)}
		type="password"
		label={$_("login.current-passphrase")}
		autocomplete="current-password"
		showsRequired={false}
		required
	/>
	<div class="buttons-2cbb2942">
		<ActionButton type="submit" disabled={!hasChanges || isLoading}
			>{$_("settings.auth.get-new-account-id")}</ActionButton
		>
		{#if hasChanges}
			<ActionButton kind="info" disabled={isLoading} on:click={reset}
				>{$_("common.reset")}</ActionButton
			>
		{/if}
	</div>
</Form>

<NewLoginModal />

<style lang="scss" global>
	.buttons-2cbb2942 {
		display: flex;
		flex-flow: row nowrap;

		:not(:last-child) {
			margin-right: 8pt;
		}
	}
</style>
