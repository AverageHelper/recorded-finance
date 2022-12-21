<script lang="ts">
	import { _ } from "../../i18n";
	import { fetchSession, pKey, uid } from "../../store";
	import { lockPath } from "../../router/routes";
	import { onMount } from "svelte";
	import { useFocus, useNavigate } from "svelte-navigator";
	import Spinner from "../../components/Spinner.svelte";

	const registerFocus = useFocus();
	const navigate = useNavigate();

	let isChecking = true;
	$: isLoggedIn = $uid !== null;
	$: isVaultUnlocked = isLoggedIn && $pKey !== null;

	$: if (!isVaultUnlocked) {
		// We're locked. Go to login:
		navigate(lockPath(), { replace: true });
	}

	onMount(async () => {
		// If we're not sure, fetch the user session
		isChecking = true;
		if (!isLoggedIn) await fetchSession();
		isChecking = false;
	});
</script>

{#if !isChecking && isVaultUnlocked}
	<slot {registerFocus} />
{:else}
	<main class="loading">
		<p>{$_("login.checking-lock-state")}</p>
		<Spinner />
	</main>
{/if}
