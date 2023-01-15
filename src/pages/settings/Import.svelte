<script lang="ts">
	import type { DatabaseSchema } from "../../model/DatabaseSchema";
	import type { Entry } from "@zip.js/zip.js";
	import { _, locale } from "../../i18n";
	import { accountsPath } from "../../router";
	import { BlobReader, TextWriter, ZipReader } from "@zip.js/zip.js";
	import { create } from "superstruct";
	import { handleError } from "../../store";
	import { schema } from "../../model/DatabaseSchema";
	import { toast } from "@zerodevx/svelte-toast";
	import { useNavigate } from "svelte-navigator";
	import ActionButton from "../../components/buttons/ActionButton.svelte";
	import FileInput from "../attachments/FileInput.svelte";
	import Form from "../../components/Form.svelte";
	import ImportProcessModal from "./ImportProcessModal.svelte";

	const navigate = useNavigate();

	let isLoading = false;
	let archive: Array<Entry> | null = null;
	let dbName = "";
	let db: DatabaseSchema | null = null;

	async function onFileReceived(event: CustomEvent<File | null>) {
		const file = event.detail;
		if (!file) return;
		archive = null;
		dbName = "";
		db = null;
		isLoading = true;

		let msg = $_("settings.import.loading-file", { values: { name: file.name } });
		const progressMeter = toast.push(msg, {
			duration: 300,
			initial: 0,
			next: 0,
			dismissable: false,
		});

		const reader = new ZipReader(new BlobReader(file));
		try {
			const zipFile = await reader.getEntries({
				onprogress: progressRaw => {
					// FIXME: We may be using this callback incorrectly
					// See https://gildas-lormeau.github.io/zip.js/api/interfaces/ZipReaderGetEntriesOptions.html#onprogress
					const percent = Intl.NumberFormat($locale.code, { style: "percent" }).format(
						progressRaw / 100
					);
					msg = $_("settings.import.loading-file-progress", {
						values: { name: file.name, percent },
					});
					toast.set(progressMeter, { msg, next: progressRaw });
				},
			});

			const expectedDbName = "recorded-finance/database.json";
			const dbFile = zipFile.find(f => f.filename === expectedDbName);
			if (!dbFile?.getData)
				throw new TypeError(
					$_("error.settings.missing-db-file", { values: { filename: expectedDbName } })
				);

			const jsonString = (await dbFile.getData(new TextWriter())) as string;
			const json = JSON.parse(jsonString) as unknown;
			db = create(json, schema);
			dbName = file.name;
			archive = zipFile;
		} catch (error) {
			handleError(error);
		} finally {
			toast.set(progressMeter, { next: 1 });
			await reader.close();
		}

		isLoading = false;
	}

	function forgetFile() {
		db = null;
		dbName = "";
		navigate(accountsPath());
	}
</script>

<Form>
	<h3>{$_("settings.import.meta.heading")}</h3>
	<p>{$_("settings.import.meta.description")}</p>

	<div class="buttons">
		<FileInput accept="application/zip" disabled={isLoading} on:input={onFileReceived} let:click>
			<ActionButton
				kind="info"
				disabled={isLoading}
				on:click={e => {
					e.preventDefault();
					click();
				}}>{$_("settings.import.start-imperative")}</ActionButton
			>
		</FileInput>
	</div>
</Form>

<ImportProcessModal fileName={dbName} {db} zip={archive} on:finished={forgetFile} />
