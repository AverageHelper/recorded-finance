<script lang="ts">
	import { _ } from "../../i18n";
	import { accountsPath } from "router/routes";
	import { fetchSession, uid } from "../../store";
	import { onMount } from "svelte";
	import { useFocus, useNavigate } from "svelte-navigator";
	import Spinner from "../../components/Spinner.svelte";

	const registerFocus = useFocus();
	const navigate = useNavigate();

	let isChecking = true;
	$: isVaultLoggedIn = $uid !== null;

	$: if (isVaultLoggedIn) {
		// Whenever we log in, go home:
		navigate(accountsPath(), { replace: true });
	}

	onMount(async () => {
		// If we're not sure, fetch the user session
		if ($uid === null) await fetchSession(); // TODO: Cache this for a few minutes?
		isChecking = false;
	});
</script>

{#if !isChecking && !isVaultLoggedIn}
	<slot {registerFocus} />
{:else}
	<main class="loading">
		<p>{$_("login.checking-login-state")}</p>
		<p><Spinner /></p>
	</main>
{/if}
