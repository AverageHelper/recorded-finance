<script lang="ts">
	import { _ } from "../../i18n";
	import { fetchSession, pKey, uid } from "../../store";
	import { lockPath } from "router/routes";
	import { onMount } from "svelte";
	import { useFocus, useNavigate } from "svelte-navigator";

	const registerFocus = useFocus();
	const navigate = useNavigate();

	let isChecking = true;
	$: isVaultUnlocked = $uid !== null && $pKey !== null;

	$: if (!isVaultUnlocked) {
		// We're locked. Go to login:
		navigate(lockPath(), { replace: true });
	}

	onMount(async () => {
		// If we're not sure, fetch the user session
		if ($uid === null) await fetchSession();

		isChecking = false;
	});
</script>

{#if !isChecking && isVaultUnlocked}
	<slot {registerFocus} />
{:else}
	<p>{$_("login.checking-lock-state")}</p>
{/if}
