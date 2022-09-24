<script lang="ts">
	import { _ } from "../../i18n";
	import { AccountableError } from "../../transport/errors";
	import { createEventDispatcher, onMount } from "svelte";
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

	/**
	 * Whether we should let the user back out early.
	 * If they validate their password, the API may want to validate
	 * TOTP as well. We shouldn't let the user make other requests
	 * until that's complete, to simplify error handling elsewhere.
	 */
	$: canClose = totpSecrets === null;

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
			handleError(new AccountableError("auth/unauthenticated"));
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
			handleError(new AccountableError("auth/unauthenticated"));
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
		if (totpSecrets?.recoveryToken && !confirm("Did you write down your recovery token?")) return;

		dispatch("finished");
	}
</script>

<!-- TODO: I18N -->
<Modal open={isOpen} closeModal={canClose ? close : null}>
	<h1>Enroll in MFA</h1>

	{#if totpSecrets === null}
		<!-- Renew existing password auth, get TOTP secret -->
		<TextField
			value={password}
			type="password"
			autocomplete="current-password"
			label={$_("login.passphrase")}
			placeholder="********"
			on:input={onPasswordInput}
		/>
		<ActionButton kind="bordered-primary" disabled={isLoading} on:click={getTotpSecret}
			>Continue</ActionButton
		>
	{:else if totpSecrets.recoveryToken === null}
		<!-- Display a TOTP secret, ask for TOTP to confirm, get recovery token -->
		<QR value={totpSecrets.secret.href} />
		<p><code>{totpSecret}</code></p>
		<TextField
			value={token}
			autocomplete="one-time-code"
			label={$_("login.totp")}
			placeholder={$_("example.totp-code")}
			on:input={onTokenInput}
		/>
		<ActionButton kind="bordered-primary" disabled={isLoading} on:click={getRecoveryToken}
			>Check</ActionButton
		>
	{:else}
		<!-- Display recovery token -->
		<p
			>Here is your recovery token. Keep it safe, somewhere you can get to it if you lose your 2FA
			auth device:</p
		>
		<p><code>{totpSecrets.recoveryToken}</code></p>
		<!-- Then close -->
		<ActionButton kind="bordered-primary" on:click={close}>I understand</ActionButton>
	{/if}
</Modal>
