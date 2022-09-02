<script lang="ts">
	import type { Attachment } from "../../model/Attachment";
	import type { Transaction } from "../../model/Transaction";
	import { _ } from "../../i18n";
	import { createEventDispatcher } from "svelte";
	import FileInput from "./FileInput.svelte";
	import FileListItem from "./FileListItem.svelte";
	import List from "../../components/List.svelte";
	import ListItem from "../../components/ListItem.svelte";
	import {
		addAttachmentToTransaction,
		transaction as copy,
		removeAttachmentIdFromTransaction,
	} from "../../model/Transaction";
	import {
		allAttachments,
		createAttachmentFromFile,
		handleError,
		updateTransaction,
	} from "../../store";

	const dispatch = createEventDispatcher<{
		close: void;
	}>();

	export let transaction: Transaction;
	export let fileId: string;

	$: numberOfFiles = $allAttachments.length;

	async function selectNewFile(attachment: Attachment) {
		const newTransaction = copy(transaction);
		addAttachmentToTransaction(newTransaction, attachment);
		removeAttachmentIdFromTransaction(newTransaction, fileId);
		await updateTransaction(newTransaction);
		dispatch("close");
	}

	async function createNewFile(event: CustomEvent<File | null>): Promise<void> {
		const file = event.detail;
		if (!file) return;

		try {
			const attachment = await createAttachmentFromFile(file);
			await selectNewFile(attachment);
		} catch (error) {
			handleError(error);
		}
	}
</script>

<div>
	<h3>{$_("files.reference.heading")}</h3>
	<p>{$_("files.reference.explanation")}</p>

	<List>
		<li>
			<FileInput on:input={createNewFile} let:click>
				<ListItem
					title={$_("files.upload.imperative")}
					to=""
					on:click={e => {
						e.preventDefault();
						click();
					}}
				/>
			</FileInput>
		</li>
		{#each $allAttachments as file (file.id)}
			<li>
				<FileListItem
					fileId={file.id}
					on:click={e => {
						e.preventDefault();
						selectNewFile(file);
					}}
				/>
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
</div>
