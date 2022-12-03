<script lang="ts">
	import { _ } from "../../i18n";
	import { fetchSession, lockVault, pKey, uid } from "../../store/authStore";
	import { loginPath } from "router/routes";
	import { navigate } from "svelte-navigator";
	import { onMount } from "svelte";
	import Spinner from "../../components/Spinner.svelte";

	let isChecking = true;
	$: isVaultLocked = $uid !== null && !$pKey; // we have a uid but no pKey

	$: if (!isVaultLocked) {
		navigate(loginPath(), { replace: true });
	}

	onMount(async () => {
		lockVault();

		// If vault is logged in and locked, continue. Otherwise, redirect to loginPath()
		if ($uid === null) await fetchSession();

		isChecking = false;
	});
</script>

{#if isChecking}
	<p>{$_("locked.locking")}</p>
	<Spinner />
{:else}
	<slot />
{/if}
