<script lang="ts">
	import type { Attachment } from "../../model/Attachment";
	import { _ } from "../../i18n";
	import { allAttachments, deleteAttachment, handleError } from "../../store";
	import ConfirmDestroyFile from "./ConfirmDestroyFile.svelte";
	import FileListItem from "./FileListItem.svelte";
	import List from "../../components/List.svelte";

	$: numberOfFiles = $allAttachments.length;

	let fileToDelete: Attachment | null = null;

	function askToDeleteFile(file: CustomEvent<Attachment>) {
		fileToDelete = file.detail;
	}

	async function confirmDeleteFile(file: CustomEvent<Attachment>) {
		try {
			await deleteAttachment(file.detail);
		} catch (error) {
			handleError(error);
		} finally {
			fileToDelete = null;
		}
	}

	function cancelDeleteFile() {
		fileToDelete = null;
	}
</script>

<main class="content">
	<div class="heading">
		<h1>{$_("files.list.heading")}</h1>
		<p>{$_("files.list.how-to-create")}</p>
	</div>

	<List>
		{#each $allAttachments as file (file.id)}
			<li>
				<FileListItem fileId={file.id} on:delete={askToDeleteFile} />
			</li>
		{/each}
		{#if numberOfFiles > 0}
			<li>
				<p class="footer"
					>{#if numberOfFiles === 1}{$_("files.count.file")}{:else}{$_("files.count.files", {
							values: { n: numberOfFiles },
						})}{/if}</p
				>
			</li>
		{/if}
	</List>
</main>

<ConfirmDestroyFile
	file={fileToDelete}
	isOpen={fileToDelete !== null}
	on:yes={confirmDeleteFile}
	on:no={cancelDeleteFile}
/>

<style lang="scss">
	@use "styles/colors" as *;

	.heading {
		max-width: 36em;
		margin: 1em auto;

		> h1 {
			margin: 0;
		}
	}

	.footer {
		color: color($secondary-label);
		user-select: none;
	}
</style>
