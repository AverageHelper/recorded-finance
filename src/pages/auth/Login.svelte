<script lang="ts">
	import { _ } from "../../i18n";
	import { accountsPath, loginPath, signupPath } from "../../router";
	import { onMount, tick } from "svelte";
	import { PlatformError, UnreachableCaseError } from "../../transport/errors";
	import { repoReadmeHeading } from "../../platformMeta";
	import { useLocation, useNavigate } from "svelte-navigator";
	import ActionButton from "../../components/buttons/ActionButton.svelte";
	import ErrorNotice from "../../components/ErrorNotice.svelte";
	import Form from "../../components/Form.svelte";
	import I18N from "../../components/I18N.svelte";
	import InfoDrawer from "../../components/InfoDrawer.svelte";
	import NopLink from "../../components/NopLink.svelte";
	import OutLink from "../../components/OutLink.svelte";
	import TextField from "../../components/inputs/TextField.svelte";
	import {
		bootstrap,
		bootstrapError,
		createAccountId,
		createVault,
		handleError,
		isSignupEnabled,
		login,
		loginWithTotp,
		loginProcessState,
		uid,
	} from "../../store";

	const location = useLocation();
	const navigate = useNavigate();

	let accountId = "";
	let password = "";
	let passwordRepeat = "";
	let token = "";
	let isLoading = false;

	$: isLoggedIn = $uid !== null;
	$: mode = !isSignupEnabled
		? needsTotp
			? ("totp" as const)
			: ("login" as const) // can't sign up? log in instead.
		: $location.pathname === signupPath()
		? ("signup" as const)
		: needsTotp
		? ("totp" as const)
		: ("login" as const);
	$: isSignupMode = mode === "signup";
	$: isLoginMode = mode === "login";
	$: isTotpMode = mode === "totp";

	let accountIdField: TextField | undefined;
	let passwordField: TextField | undefined;
	let totpField: TextField | undefined;
	let needsTotp = false;

	onMount(() => {
		accountIdField?.focus();
		bootstrap();
	});

	$: switch (mode) {
		case "login":
			accountIdField?.focus();
			break;
		case "signup":
			passwordField?.focus();
			break;
	}

	$: if (isLoggedIn) {
		navigate(accountsPath());
	} else if ($location.pathname !== loginPath() && $location.pathname !== signupPath()) {
		switch (mode) {
			case "login":
				navigate(loginPath());
				break;
			case "signup":
				navigate(signupPath());
				break;
		}
	}

	$: if (isTotpMode) {
		// Focus the field when we enter TOTP mode
		totpField?.focus();
	}

	function enterSignupMode() {
		if (isLoading) return;
		accountId = "";
		navigate(signupPath(), { replace: true });
	}

	function enterLoginMode() {
		if (isLoading) return;
		accountId = "";
		navigate(loginPath(), { replace: true });
	}

	function onUpdateAccountId(event: CustomEvent<string>) {
		if (!isSignupMode || isLoading) {
			accountId = event.detail;
		} else {
			// Prevent overwriting the given account ID when signing up.
			// There are no technical back-end restrictions to necessitate this,
			// and an API user can just send whatever account ID they want;
			// we just don't want to be responsible for storing any more
			// user data than we need, so we provide this one.
			// (This might be a stupid idea. I'll find out later.)
			accountId = accountId;
		}
	}

	async function onUpdateTotp(event: CustomEvent<string>) {
		token = event.detail;
		await tick();
		if (token.length === 6 && /^\d+$/.test(token)) {
			// Only if six digits
			submit();
		}
	}

	function onUpdatePassphrase(event: CustomEvent<string>) {
		password = event.detail;
	}

	function onUpdateRepeatPassphrase(event: CustomEvent<string>) {
		passwordRepeat = event.detail;
	}

	async function submit() {
		try {
			isLoading = true;
			if (isSignupMode) {
				// Don't let the user pick their own account ID
				accountId = createAccountId();
			}

			if (!accountId || !password || (isSignupMode && !passwordRepeat))
				throw new Error($_("error.form.missing-required-fields"));
			if (isSignupMode && password !== passwordRepeat)
				throw new Error($_("error.form.password-mismatch"));

			console.debug(`Doing ${mode}`);
			switch (mode) {
				case "signup":
					await createVault(accountId, password);
					break;

				case "login":
					await login(accountId, password);
					break;

				case "totp":
					await loginWithTotp(password, token);
					break;

				default:
					throw new UnreachableCaseError(mode);
			}
			console.debug(`Finished ${mode}`);

			navigate(accountsPath(), { replace: true });
		} catch (error) {
			// FIXME: Better semantics here:
			if (error instanceof PlatformError && error.code === "auth/unauthenticated") {
				// Switch to TOTP mode
				needsTotp = true;
				console.debug(`Entering ${mode} mode`);
				return;
			}
			// Otherwise, treat the error like a problem:
			handleError(error);
		} finally {
			isLoading = false;
		}
	}
</script>

<!-- TODO: Break this component into three: Login, Signup, TOTP -->

<main class="content">
	{#if $bootstrapError}
		<ErrorNotice error={$bootstrapError} />
	{:else}
		<Form on:submit={submit}>
			<h1>{$_("login.log-in")}</h1>
			<div>
				{#if !isSignupEnabled}
					<p>{$_("login.new-account-prompt.open-soon")}</p>
				{:else if isLoginMode}
					<p
						>{$_("login.new-account-prompt.create.question")}
						<NopLink on:click={enterSignupMode}
							>{$_("login.new-account-prompt.create.action")}</NopLink
						>
					</p>
				{:else if isSignupMode}
					<p
						>{$_("login.new-account-prompt.already-have.question")}
						<NopLink on:click={enterLoginMode}
							>{$_("login.new-account-prompt.already-have.action")}</NopLink
						>
					</p>
				{/if}
			</div>

			{#if isSignupMode && !isLoading}
				<TextField
					value={$_("login.value-will-be-generated")}
					disabled={isSignupMode && !isLoading}
					label={$_("login.account-id")}
					placeholder={$_("example.account-id")}
					autocomplete="username"
				/>
			{:else if isLoginMode}
				<TextField
					bind:this={accountIdField}
					value={accountId}
					on:input={onUpdateAccountId}
					disabled={isLoading}
					label={$_("login.account-id")}
					placeholder={$_("example.account-id")}
					autocomplete="username"
					showsRequired={false}
					required
				/>
			{:else if isTotpMode}
				<TextField
					bind:this={totpField}
					value={token}
					on:input={onUpdateTotp}
					disabled={isLoading}
					label={$_("login.totp")}
					placeholder={$_("example.totp-code")}
					autocomplete="one-time-code"
					showsRequired={false}
					required
				/>
			{/if}
			{#if isLoginMode}
				<TextField
					bind:this={passwordField}
					value={password}
					on:input={onUpdatePassphrase}
					type="password"
					label={isSignupMode ? $_("login.new-passphrase-imperative") : $_("login.passphrase")}
					autocomplete={isSignupMode ? "new-password" : "current-password"}
					showsRequired={false}
					required
				/>
			{/if}
			{#if isSignupMode}
				<TextField
					value={passwordRepeat}
					on:input={onUpdateRepeatPassphrase}
					type="password"
					label={$_("login.repeat-passphrase")}
					autocomplete="new-password"
					showsRequired={false}
					required={isSignupMode}
				/>
			{/if}
			<ActionButton
				type="submit"
				kind={isSignupMode ? "secondary" : "primary"}
				disabled={isLoading}
			>
				{#if $loginProcessState === null}
					<span>{isSignupMode ? $_("login.create-account") : $_("login.log-in")}</span>
				{:else if $loginProcessState === "AUTHENTICATING"}
					<span>{$_("login.log-in-ongoing")}: {$_("login.process.authenticating")}</span>
				{:else if $loginProcessState === "GENERATING_KEYS"}
					<span>{$_("login.log-in-ongoing")}: {$_("login.process.generating-keys")}</span>
				{:else if $loginProcessState === "FETCHING_KEYS"}
					<span>{$_("login.log-in-ongoing")}: {$_("login.process.fetching-keys")}</span>
				{:else if $loginProcessState === "DERIVING_PKEY"}
					<span>{$_("login.log-in-ongoing")}: {$_("login.process.deriving-pkey")}</span>
				{/if}
			</ActionButton>

			<InfoDrawer title={$_("login.cookie-disclaimer-header")}>
				<p>
					<I18N keypath="login.cookie-disclaimer">
						<!-- more -->
						<OutLink to={repoReadmeHeading("why-use-cookies")}>{$_("login.cookie-more")}</OutLink>
					</I18N>
				</p>
			</InfoDrawer>
		</Form>
	{/if}
</main>
