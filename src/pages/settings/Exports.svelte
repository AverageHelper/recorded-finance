<script lang="ts">
	import type { AttachmentSchema } from "../../model/DatabaseSchema";
	import type { Attachment } from "../../model/Attachment";
	import { _ } from "../../i18n";
	import { attachment as newAttachment } from "../../model/Attachment";
	import { asyncMap, dataUriToBlob, downloadFileAtUrl } from "../../transport";
	import { BlobReader, Data64URIWriter, TextReader, ZipWriter } from "@zip.js/zip.js";
	import { getAllUserDataAsJson, handleError, imageDataFromFile } from "../../store";
	import ActionButton from "../../components/buttons/ActionButton.svelte";
	import I18N from "../../components/I18N.svelte";

	let isLoading = false;

	// TODO: Move this into a store
	async function downloadStuff(event: Event, shouldMinify: boolean) {
		event.preventDefault();
		isLoading = true;
		console.debug("Preparing zip writer");
		const writer = new ZipWriter(new Data64URIWriter("application/zip"));
		console.debug("Prepared zip writer");

		try {
			const rootName = "accountable";
			console.debug("Writing root folder");
			console.debug("Wrote root folder");

			// ** Prepare database
			console.debug("Getting user data");
			const rawData = await getAllUserDataAsJson();
			console.debug("Got user data");
			console.debug("Encoding user data");
			const data = JSON.stringify(rawData, undefined, shouldMinify ? undefined : "\t");
			const encodedData = data; // btoa(data);
			console.debug("Encoded user data");
			console.debug("Writing user data");
			await writer.add(
				`${rootName}/database${shouldMinify ? "-raw" : ""}.json`,
				new TextReader(encodedData)
			);
			console.debug("Wrote user data");

			// ** Prepare attachments

			/** Mirrors the storage bucket layout */
			const userFilesPath = `${rootName}/storage/users/${rawData.uid}/attachments`;

			const filesToGet: Array<AttachmentSchema> = rawData.attachments ?? [];
			// FIXME: We may run out of memory here. Test with many files totaling more than 1 GB. Maybe operate on the attachments a few at a time?
			console.debug("Downloading attachments");
			const filesGotten: Array<[Attachment, string]> = await asyncMap(filesToGet, async a => {
				const file = newAttachment({
					createdAt: a.createdAt,
					id: a.id,
					notes: a.notes?.trim() ?? null,
					storagePath: a.storagePath,
					title: a.title.trim(),
					type: a.type ?? "",
				});
				const data = await imageDataFromFile(file, false);
				return [file, data];
			});
			console.debug("Downloaded attachments");
			for (const [f, d] of filesGotten) {
				// Get storage file name without extension, so that explorers don't try to treat the folder as JSON
				const mystifiedName = f.storagePath
					.slice(Math.max(0, f.storagePath.lastIndexOf("/") + 1))
					.split(".")[0] as string;
				const imagePath = `${userFilesPath}/${mystifiedName}/${f.title}`;
				const image = dataUriToBlob(d);
				console.debug(`Adding attachment ${f.title} to zip`);
				await writer.add(imagePath, new BlobReader(image));
				console.debug(`Added attachment ${f.title} to zip`);
			}

			// ** Zip them up
			console.debug("Grabbing zip blob");
			const dataUri = (await writer.close()) as string;
			console.debug(`Got ${dataUri.length}-byte zip blob`);

			// ** Get it
			downloadFileAtUrl(dataUri, "accountable.zip");
		} catch (error) {
			handleError(error);
			await writer.close();
		}
		isLoading = false;
	}
</script>

<form on:submit|preventDefault>
	<h3>{$_("settings.export.meta.heading")}</h3>
	<p>
		<I18N keypath="settings.export.meta.description">
			<!-- unencrypted -->
			<strong>{$_("settings.export.meta.unencrypted")}</strong>
		</I18N>
	</p>
	{#if false}
		<!-- TODO: I18N -->
		<p
			>This export might get big, and about 1/3 of it is spacing to make the JSON more
			human-readable. If you don't care about that, then we can just export the raw JSON data as
			small as we can make it.</p
		>
	{/if}
	<div class="buttons-6933f502">
		<ActionButton kind="bordered" disabled={isLoading} on:click={e => downloadStuff(e, false)}
			>{$_("settings.export.actions.export-all")}</ActionButton
		>
		{#if false}
			<ActionButton kind="bordered" disabled={isLoading} on:click={e => downloadStuff(e, true)}
				>{$_("settings.export.actions.export-all")}</ActionButton
			>
			<ActionButton kind="bordered" disabled={isLoading} on:click={e => downloadStuff(e, false)}
				>{$_("settings.export.actions.export-all-nicely")}</ActionButton
			>
		{/if}
	</div>
</form>

<style lang="scss" global>
	p {
		margin-bottom: 0;
	}

	.buttons-6933f502 {
		display: flex;
		flex-flow: row wrap;

		:not(:last-child) {
			margin-right: 8pt;
		}
	}
</style>
