<script lang="ts">
	import type { Attachment } from "../../model/Attachment";
	import { _ } from "../../i18n";
	import { downloadFileAtUrl } from "../../transport";
	import { files } from "../../store";
	import ActionButton from "./ActionButton.svelte";
	import DownloadIcon from "../../icons/Download.svelte";

	export let file: Attachment;

	$: imgUrl = $files[file.id] ?? null;
	$: disabled = imgUrl === null;

	function startDownload(event: Event) {
		event.preventDefault();
		if (imgUrl === null || !imgUrl) return;

		downloadFileAtUrl(imgUrl, file.title);
	}
</script>

<div class="download-button">
	<ActionButton kind="info" {disabled} on:click={startDownload}>
		<DownloadIcon />
		<span>{$_("common.download-action")}</span>
	</ActionButton>
</div>

<style lang="scss">
	div.download-button {
		:global(.icon) {
			margin-right: 6pt;
		}
	}
</style>
