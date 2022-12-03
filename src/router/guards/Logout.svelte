<script lang="ts">
	import { _ } from "../../i18n";
	import { loginPath } from "../routes";
	import { logout } from "../../store";
	import { onMount } from "svelte";
	import { useLocation, useNavigate } from "svelte-navigator";
	import Spinner from "../../components/Spinner.svelte";

	const location = useLocation();
	const navigate = useNavigate();

	function goToLogin() {
		navigate(loginPath(), {
			state: { from: $location.pathname },
			replace: true,
		});
	}

	onMount(async () => {
		await logout();
		// We're logged out. Go to login:
		goToLogin();
	});
</script>

<main class="content">
	<p>{$_("login.logging-out")}</p>
	<Spinner />
</main>
