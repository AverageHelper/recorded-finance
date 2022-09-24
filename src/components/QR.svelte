<script lang="ts">
	import { toCanvas } from "qrcode";
	import ErrorNotice from "./ErrorNotice.svelte";

	export let value: string;

	let canvas: HTMLCanvasElement | undefined;
	let error: Error | null | undefined;

	$: if (canvas) {
		toCanvas(canvas, value, err => {
			error = err;
		});
	}
</script>

<div>
	<canvas bind:this={canvas} />
	{#if error}
		<ErrorNotice {error} />
	{/if}
</div>
