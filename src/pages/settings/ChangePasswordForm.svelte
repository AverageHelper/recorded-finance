<script lang="ts">
	import { _ } from "../../i18n";
	import { currentUser } from "../../store/authStore";
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
	let token = "";

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

			await updatePassword(currentPassword, newPassword, token);
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
	{#if $currentUser?.mfa.includes("totp")}
		<TextField
			value={token}
			on:input={e => (token = e.detail)}
			label={$_("login.totp")}
			autocomplete="one-time-code"
			showsRequired={false}
			required
		/>
	{/if}

	<div class="buttons">
		<ActionButton type="submit" disabled={!hasChanges || isLoading}
			>{$_("settings.auth.update-passphrase")}</ActionButton
		>
		{#if hasChanges}
			<ActionButton kind="info" disabled={isLoading} on:click={reset}
				>{$_("common.reset")}</ActionButton
			>
		{/if}
	</div>
</Form>
