<script lang="ts">
	import { _ } from "../../i18n";
	import { handleError } from "../../store";
	import { toast } from "@zerodevx/svelte-toast";
	import { updatePassword } from "../../store/authStore";
	import ActionButton from "../../components/buttons/ActionButton.svelte";
	import Form from "../../components/Form.svelte";
	import TextField from "../../components/inputs/TextField.svelte";

	let isLoading = false;
	let currentPassword = "";
	let newPassword = "";
	let newPasswordRepeat = "";

	$: hasChanges = currentPassword !== "" && newPassword !== "" && newPassword === newPasswordRepeat;

	function reset(event?: Event) {
		event?.preventDefault();
		currentPassword = "";
		newPassword = "";
		newPasswordRepeat = "";
	}

	async function submitNewPassword() {
		try {
			if (!currentPassword || !newPassword || !newPasswordRepeat) {
				throw new Error($_("error.form.missing-required-fields"));
			}
			if (newPassword !== newPasswordRepeat) {
				throw new Error($_("error.form.password-mismatch"));
			}

			isLoading = true;

			await updatePassword(currentPassword, newPassword);
			toast.push($_("settings.auth.passphrase-updated"), { classes: ["toast-success"] });
			reset();
		} catch (error) {
			handleError(error);
		}
		isLoading = false;
	}
</script>

<Form on:submit={submitNewPassword}>
	<h3>{$_("settings.auth.passphrase-heading")}</h3>
	<TextField
		value={currentPassword}
		on:input={e => (currentPassword = e.detail)}
		type="password"
		label={$_("login.current-passphrase")}
		autocomplete="current-password"
		showsRequired={false}
		required
	/>
	<TextField
		value={newPassword}
		on:input={e => (newPassword = e.detail)}
		type="password"
		label={$_("login.new-passphrase")}
		autocomplete="new-password"
		showsRequired={false}
		required
	/>
	<TextField
		value={newPasswordRepeat}
		on:input={e => (newPasswordRepeat = e.detail)}
		type="password"
		label={$_("login.new-passphrase-repeat")}
		autocomplete="new-password"
		showsRequired={false}
		required
	/>
	<div class="buttons-47e1be0c">
		<ActionButton type="submit" kind="bordered-primary" disabled={!hasChanges || isLoading}
			>{$_("settings.auth.update-passphrase")}</ActionButton
		>
		{#if hasChanges}
			<ActionButton kind="bordered" disabled={isLoading} on:click={reset}
				>{$_("common.reset")}</ActionButton
			>
		{/if}
	</div>
</Form>

<style lang="scss" global>
	.buttons-47e1be0c {
		display: flex;
		flex-flow: row nowrap;

		:not(:last-child) {
			margin-right: 8pt;
		}
	}
</style>
