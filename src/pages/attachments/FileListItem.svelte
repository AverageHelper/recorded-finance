<script lang="ts">
	import type { Attachment } from "../../model/Attachment";
	import { _, locale } from "../../i18n";
	import { attachments } from "../../store";
	import { createEventDispatcher } from "svelte";
	import { toTimestamp } from "../../transformers";
	import FileView from "./FileView.svelte";
	import ListItem from "../../components/ListItem.svelte";
	import Modal from "../../components/Modal.svelte";

	const dispatch = createEventDispatcher<{
		delete: Attachment;
		"delete-reference": string;
		keyup: KeyboardEvent;
		click: MouseEvent;
	}>();

	export let fileId: string;

	$: file = $attachments[fileId];
	$: title = file?.title ?? fileId;
	$: timestamp = file ? toTimestamp($locale.code, file.createdAt) : "--";
	$: subtitle = !file
		? $_("files.reference.broken")
		: file.notes === null || !file.notes
		? timestamp
		: `${file.notes} - ${timestamp}`;

	let isModalOpen = false;

	function presentImageModal(event: CustomEvent<MouseEvent> | CustomEvent<KeyboardEvent>) {
		event.preventDefault();
		event.detail.preventDefault();

		if ("key" in event.detail) {
			if (event.detail.key === " ") {
				isModalOpen = true;
			}
			dispatch("keyup", event.detail);
		} else {
			dispatch("click", event.detail);
			isModalOpen = true;
		}
	}

	function closeModal() {
		isModalOpen = false;
	}

	function askToDelete(file: CustomEvent<Attachment>) {
		dispatch("delete", file.detail);
	}

	function askToDeleteReference() {
		dispatch("delete-reference", fileId);
	}
</script>

<ListItem {title} {subtitle} to="" on:keyup={presentImageModal} on:click={presentImageModal} />
<Modal open={isModalOpen && !!file} {closeModal}>
	<FileView {file} on:delete={askToDelete} on:deleteReference={askToDeleteReference} />
</Modal>
