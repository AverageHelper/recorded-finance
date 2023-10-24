<!--
	@component

	When mounted, redirects to the provided path.
 -->
<script lang="ts">
	import { logger } from "../../logger";
	import { onMount } from "svelte";
	import { useLocation, useNavigate } from "svelte-navigator";

	export let to: string;

	const location = useLocation();
	const navigate = useNavigate();

	onMount(() => {
		logger.warn(`We should not have landed at '${$location.pathname}', redirecting to '${to}'...`);

		navigate(to, { replace: true });
	});
</script>
