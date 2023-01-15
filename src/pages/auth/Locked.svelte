<script lang="ts">
	import { _ } from "../../i18n";
	import { accountsPath } from "../../router";
	import { NetworkError, PlatformError } from "../../transport/errors";
	import { onMount, tick } from "svelte";
	import { useNavigate } from "svelte-navigator";
	import ActionButton from "../../components/buttons/ActionButton.svelte";
	import ErrorNotice from "../../components/ErrorNotice.svelte";
	import Form from "../../components/Form.svelte";
	import TextField from "../../components/inputs/TextField.svelte";
	import {
		accountId as _accountId,
		bootstrap,
		bootstrapError,
		handleError,
		loginProcessState,
		loginWithTotp,
		unlockVault,
	} from "../../store";

	const navigate = useNavigate();

	$: accountId = $_accountId ?? "";
	let password = "";
	let token = "";
	let needsTotp = false;
	let isLoading = false;

	let passwordField: TextField | undefined;
	let totpField: TextField | undefined;

	onMount(() => {
		passwordField?.focus();
		bootstrap();
	});

	$: if (needsTotp) {
		// Focus the field when we enter TOTP mode
		totpField?.focus();
	}

	function onPasswordInput(event: CustomEvent<string>) {
		password = event.detail;
	}

	async function onTotpInput(event: CustomEvent<string>) {
		token = event.detail;
		await tick();
		if (token.length === 6 && /^\d+$/.test(token)) {
			// Only if six digits
			submit();
		}
	}

	async function submit() {
		try {
			isLoading = true;

			if (!accountId || !password) throw new Error($_("error.form.missing-required-fields"));

			if (needsTotp) {
				await loginWithTotp(password, token);
			} else {
				await unlockVault(password);
			}

			navigate(accountsPath(), { replace: true });
		} catch (error) {
			if (
				(error instanceof NetworkError && error.code === "missing-mfa-credentials") ||
				(error instanceof NetworkError && error.code === "missing-token") ||
				(error instanceof PlatformError && error.code === "auth/unauthenticated")
			) {
				// Switch to TOTP mode
				needsTotp = true;
				return;
			}
			handleError(error);
		} finally {
			isLoading = false;
		}
	}
</script>

<main class="content">
	{#if $bootstrapError}
		<ErrorNotice error={$bootstrapError} />
	{:else}
		<Form on:submit={submit}>
			<h1>{$_("locked.heading")}</h1>
			<p>{$_("locked.explanation")}</p>

			{#if needsTotp}
				<TextField
					bind:this={totpField}
					value={token}
					on:input={onTotpInput}
					disabled={isLoading}
					label={$_("login.totp")}
					placeholder={$_("example.totp-code")}
					autocomplete="one-time-code"
					showsRequired={false}
					required
				/>
			{:else}
				<TextField
					value={accountId}
					disabled={true}
					label={$_("login.account-id")}
					autocomplete="username"
					showsRequired={false}
					required
				/>
				<TextField
					bind:this={passwordField}
					value={password}
					on:input={onPasswordInput}
					type="password"
					label={$_("login.passphrase")}
					autocomplete="current-password"
					showsRequired={false}
					required
				/>
			{/if}
			<ActionButton type="submit" disabled={isLoading}>
				{#if $loginProcessState === null}
					<span>{$_("locked.unlock")}</span>
				{:else if $loginProcessState === "AUTHENTICATING"}
					<span>{$_("locked.unlock-ongoing")}: {$_("login.process.reauthenticating")}</span>
				{:else if $loginProcessState === "GENERATING_KEYS"}
					<span>{$_("locked.unlock-ongoing")}: {$_("login.process.generating-keys")}</span>
				{:else if $loginProcessState === "FETCHING_KEYS"}
					<span>{$_("locked.unlock-ongoing")}: {$_("login.process.fetching-keys")}</span>
				{:else if $loginProcessState === "DERIVING_PKEY"}
					<span>{$_("locked.unlock-ongoing")}: {$_("login.process.deriving-pkey")}</span>
				{/if}
			</ActionButton>
		</Form>
	{/if}
</main>
