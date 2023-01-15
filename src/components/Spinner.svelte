<script lang="ts">
	import type { Color } from "sveltestrap/src/shared";
	import { Spinner } from "sveltestrap";

	export let color: Color = "primary";
</script>

<div class="spinner">
	<Spinner {color} />
</div>

<style lang="scss">
	.spinner {
		height: fit-content;
		width: fit-content;
	}
</style>
