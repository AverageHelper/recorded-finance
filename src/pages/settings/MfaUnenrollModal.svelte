<script lang="ts">
	import { _ } from "../../i18n";
	import { createEventDispatcher, onMount } from "svelte";
	import { currentUser, handleError, unenrollTotp } from "../../store";
	import ActionButton from "../../components/buttons/ActionButton.svelte";
	import Modal from "../../components/Modal.svelte";
	import TextField from "../../components/inputs/TextField.svelte";

	const dispatch = createEventDispatcher<{
		finished: void;
	}>();

	export let isOpen: boolean;

	$: isEnrolled = $currentUser?.mfa.includes("totp") === true;
	let password = "";
	let token = "";
	let isLoading = false;

	onMount(() => {
		// If not already enrolled, close immediately
		if (!isEnrolled) close();
	});

	function onPasswordInput(event: CustomEvent<string>) {
		password = event.detail;
	}

	function onTokenInput(event: CustomEvent<string>) {
		token = event.detail;
	}

	async function disable2fa() {
		if (isLoading) return;

		try {
			isLoading = true;
			await unenrollTotp(password, token);
			close();
		} catch (error) {
			handleError(error);
		} finally {
			isLoading = false;
		}
	}

	function close() {
		dispatch("finished");
	}
</script>

<!-- TODO: I18N -->
<Modal open={isOpen} closeModal={close}>
	<h1>Unenroll from MFA</h1>

	<!-- Renew existing password auth -->
	<TextField
		value={password}
		type="password"
		autocomplete="current-password"
		label={$_("login.passphrase")}
		placeholder="********"
		on:input={onPasswordInput}
	/>

	<!-- Renew existing TOTP auth -->
	<TextField
		value={token}
		autocomplete="one-time-code"
		label={$_("login.totp")}
		placeholder={$_("example.totp-code")}
		on:input={onTokenInput}
	/>

	<!-- Then close -->
	<ActionButton kind="bordered-destructive" disabled={isLoading} on:click={disable2fa}
		>Disable 2FA</ActionButton
	>
</Modal>
