<script lang="ts">
	import { _ } from "../../i18n";
	import { createEventDispatcher, onMount } from "svelte";
	import { PlatformError } from "../../transport/errors";
	import ActionButton from "../../components/buttons/ActionButton.svelte";
	import Modal from "../../components/Modal.svelte";
	import TextField from "../../components/inputs/TextField.svelte";
	import QR from "../../components/QR.svelte";
	import {
		beginTotpEnrollment,
		confirmTotpEnrollment,
		currentUser,
		handleError,
		login,
	} from "../../store";

	const dispatch = createEventDispatcher<{
		finished: void;
	}>();

	interface TotpMaterial {
		secret: URL;
		recoveryToken: string | null;
	}

	export let isOpen: boolean;

	$: isEnrolled = $currentUser?.mfa.includes("totp") === true;
	let password = "";
	let token = "";
	let isLoading = false;

	// Need to have confirmed auth to reliably resolve secrets
	let totpSecrets: TotpMaterial | null = null;
	$: totpSecret = totpSecrets?.secret.searchParams.get("secret") ?? null;

	onMount(() => {
		// If already enrolled, close immediately
		if (isEnrolled) close();
	});

	function onPasswordInput(event: CustomEvent<string>) {
		password = event.detail;
	}

	function onTokenInput(event: CustomEvent<string>) {
		token = event.detail;
	}

	async function getTotpSecret() {
		if (isLoading) return;

		// Must already be logged in
		const accountId = $currentUser?.accountId;
		if (accountId === undefined) {
			handleError(new PlatformError("auth/unauthenticated"));
			return;
		}

		try {
			isLoading = true;

			// Check the password
			await login(accountId, password);

			// Fetch secret
			const secret = await beginTotpEnrollment();
			totpSecrets = { secret, recoveryToken: null };
		} catch (error) {
			handleError(error);
		} finally {
			isLoading = false;
		}
	}

	async function getRecoveryToken() {
		if (isLoading) return;

		// Must have already retrieved a secret
		if (totpSecrets === null) {
			handleError(new PlatformError("auth/unauthenticated"));
			return;
		}

		try {
			isLoading = true;

			// Check the token, fetch recovery token
			const recoveryToken = await confirmTotpEnrollment(token);
			totpSecrets.recoveryToken = recoveryToken;
		} catch (error) {
			handleError(error);
		} finally {
			isLoading = false;
		}
	}

	function close() {
		if (totpSecrets?.recoveryToken && !confirm("Did you write down your recovery token?")) {
			totpSecrets = null;
			return;
		}

		dispatch("finished");
	}
</script>

<Modal open={isOpen} closeModal={close}>
	<h1>{$_("settings.mfa.enroll.heading")}</h1>

	{#if totpSecrets === null}
		<!-- Renew existing password auth, get TOTP secret -->
		<p>{$_("settings.mfa.enroll.enter-password")}</p>
		<TextField
			value={password}
			type="password"
			autocomplete="current-password"
			label={$_("login.passphrase")}
			on:input={onPasswordInput}
		/>
		<ActionButton disabled={isLoading} on:click={getTotpSecret}
			>{$_("settings.mfa.enroll.continue-action")}</ActionButton
		>
	{:else if totpSecrets.recoveryToken === null}
		<!-- Display a TOTP secret, ask for TOTP to confirm, get recovery token -->
		<p>{$_("settings.mfa.enroll.scan-secret")}</p>
		<QR value={totpSecrets.secret.href} />
		<p>{$_("settings.mfa.enroll.manual-secret-input")} <code>{totpSecret}</code></p>
		<TextField
			value={token}
			autocomplete="one-time-code"
			label={$_("login.totp")}
			placeholder={$_("example.totp-code")}
			on:input={onTokenInput}
		/>
		<ActionButton disabled={isLoading} on:click={getRecoveryToken}
			>{$_("settings.mfa.enroll.check-code-action")}</ActionButton
		>
	{:else}
		<!-- Display recovery token -->
		<p>{$_("settings.mfa.enroll.recovery-code-explanation")}</p>
		<p><code>{totpSecrets.recoveryToken}</code></p>
		<!-- Then close -->
		<ActionButton on:click={close}>{$_("settings.mfa.enroll.acknowledge-action")}</ActionButton>
	{/if}
</Modal>
