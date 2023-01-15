<script lang="ts">
	import type { Tab } from "../../model/ui/tabs";
	import { _ } from "../../i18n";
	import { accountsPath } from "../../router/routes";
	import { fetchSession, uid } from "../../store";
	import { isAppTab } from "../../model/ui/tabs";
	import { onMount } from "svelte";
	import { useFocus, useLocation, useNavigate } from "svelte-navigator";
	import Spinner from "../../components/Spinner.svelte";

	const registerFocus = useFocus();
	const navigate = useNavigate();
	const location = useLocation();

	function appTabOrUndefined(tbd: string | undefined): Tab | undefined {
		if (!isAppTab(tbd)) return undefined;
		return tbd;
	}

	$: currentTab = appTabOrUndefined(
		$location.pathname
			.split("/") // split path by delimiters
			.find(s => s !== "")
	); // get first nonempty path segment
	$: isInSafeZone = currentTab !== undefined;

	let isChecking = true;
	$: isVaultLoggedIn = $uid !== null;

	$: if (isVaultLoggedIn && !isInSafeZone) {
		// Whenever we log in, go home if we aren't already in the safe zone:
		navigate(accountsPath(), { replace: true });
	}

	onMount(async () => {
		// If we're not sure, fetch the user session
		if (!isVaultLoggedIn) await fetchSession(); // TODO: Cache this for a few minutes?
		isChecking = false;
	});
</script>

{#if !isChecking && !isVaultLoggedIn}
	<slot {registerFocus} />
{:else}
	<main class="loading">
		<p>{$_("login.checking-login-state")}</p>
		<Spinner />
	</main>
{/if}
