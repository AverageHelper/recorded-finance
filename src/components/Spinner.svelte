<script lang="ts">
	import type { Color } from "sveltestrap/src/shared";
	import { Spinner } from "sveltestrap";

	export let color: Color = "primary";
</script>

<Spinner {color} />
