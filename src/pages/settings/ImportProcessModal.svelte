<script lang="ts">
	import type { Account } from "../../model/Account";
	import type { DatabaseSchema } from "../../model/DatabaseSchema";
	import type { Entry } from "@zip.js/zip.js";
	import { _, locale } from "../../i18n";
	import { account as newAccount } from "../../model/Account";
	import { createEventDispatcher, tick } from "svelte";
	import { toast } from "@zerodevx/svelte-toast";
	import ActionButton from "../../components/buttons/ActionButton.svelte";
	import AccountListItem from "../../pages/accounts/AccountListItem.svelte";
	import Checkmark from "../../icons/Checkmark.svelte";
	import List from "../../components/List.svelte";
	import Modal from "../../components/Modal.svelte";
	import {
		allAccounts as storedAccounts,
		handleError,
		importAccount,
		importAttachments,
		importLocations,
		importTags,
	} from "../../store";

	const dispatch = createEventDispatcher<{
		finished: void;
	}>();

	export let fileName: string = "";
	export let zip: Array<Entry> | null = null;
	export let db: DatabaseSchema | null = null;

	let accountIdsToImport = new Set<string>();
	$: numberOfAttachmentsToImport = db?.attachments?.length ?? 0;
	$: numberOfLocationsToImport = db?.locations?.length ?? 0;
	$: numberOfTagsToImport = db?.tags?.length ?? 0;

	let isImporting = false;
	let itemsImported = 0;

	function numberOfTransactionsToImport(): number {
		let count = 0;
		accountIdsToImport.forEach(a => {
			count += transactionCounts[a] ?? 0;
		});
		return count;
	}
	$: totalItemsToImport =
		numberOfTransactionsToImport() +
		numberOfTagsToImport +
		numberOfLocationsToImport +
		numberOfAttachmentsToImport +
		accountIdsToImport.size;

	$: importProgress =
		totalItemsToImport === 0 //
			? 1
			: itemsImported / totalItemsToImport;
	$: importProgressPercent = Intl.NumberFormat($locale.code, { style: "percent" }) //
		.format(importProgress);

	$: hasDb = db !== null;
	$: importedAccounts = (db?.accounts ?? []) //
		.map(acct =>
			newAccount({
				createdAt: acct.createdAt,
				id: acct.id,
				notes: acct.notes?.trim() ?? null,
				title: acct.title.trim(),
			})
		);

	$: duplicateAccounts = importedAccounts //
		.filter(a1 => $storedAccounts.some(a2 => a2.id === a1.id));

	$: newAccounts = importedAccounts //
		.filter(a1 => !$storedAccounts.some(a2 => a2.id === a1.id));

	let transactionCounts: Record<string, number> = {};
	$: (db?.accounts ?? []).forEach(a => {
		transactionCounts[a.id] = (a.transactions ?? []).length;
	});

	$: if (hasDb && importedAccounts.length === 0) {
		toast.push(
			$_("settings.import.file-has-no-financial-data", {
				values: { file: fileName || $_("settings.import.given-file-name-unknown") },
			})
		);
		forgetDb();
	}

	function toggleAccount(
		event: CustomEvent<MouseEvent> | CustomEvent<KeyboardEvent>,
		account: Account
	) {
		event.preventDefault();
		event.detail.preventDefault();

		// Don't modify import state while we're importing
		if (isImporting) return;

		// If keyboard, make sure it's space
		if ("key" in event.detail && event.detail.key !== " ") return;

		if (accountIdsToImport.has(account.id)) {
			accountIdsToImport.delete(account.id);
		} else {
			accountIdsToImport.add(account.id);
		}
		accountIdsToImport = accountIdsToImport; // mark for reaction
	}

	function forgetDb() {
		if (!isImporting) {
			dispatch("finished");
		}
	}

	// TODO: Analyze the consequenses of this import. Will this overwrite some entries, and add other ones?
	async function beginImport(event: Event) {
		event.preventDefault();
		if (!db) return;
		isImporting = true;
		itemsImported = 0;

		try {
			for (const accountId of accountIdsToImport) {
				const accountToImport = db.accounts?.find(a => a.id === accountId);
				if (!accountToImport) continue;
				await importAccount(accountToImport);

				itemsImported += transactionCounts[accountToImport.id] ?? 0;
				itemsImported += 1;
				await tick();
			}

			await importLocations(db.locations ?? []);
			itemsImported += numberOfLocationsToImport;
			await tick();

			await importTags(db.tags ?? []);
			itemsImported += numberOfTagsToImport;
			await tick();

			await importAttachments(db.attachments ?? [], zip);
			itemsImported += numberOfAttachmentsToImport;
			await tick();

			toast.push($_("settings.import.success"), { classes: ["toast-success"] });
			dispatch("finished");
		} catch (error) {
			handleError(error);
		}

		isImporting = false;
	}
</script>

<Modal open={hasDb} closeModal={forgetDb}>
	<h1>{$_("settings.import.heading", { values: { fileName } })}</h1>

	{#if newAccounts.length > 0}
		<div>
			<h4>{$_("settings.import.new-accounts")}</h4>
			<List>
				{#each newAccounts as account (account.id)}
					<li class="importable">
						<AccountListItem
							{account}
							link={false}
							count={transactionCounts[account.id] ?? 0}
							on:keyup={e => toggleAccount(e, account)}
							on:click={e => toggleAccount(e, account)}
						/>
						{#if accountIdsToImport.has(account.id)}
							<Checkmark />
						{/if}
					</li>
				{/each}
			</List>
		</div>
	{/if}

	{#if duplicateAccounts.length > 0}
		<div>
			<h4>{$_("settings.import.duplicate-accounts")}</h4>
			<p>{$_("settings.import.duplicates-explanation")}</p>
			<List>
				{#each duplicateAccounts as account (account.id)}
					<li class="importable">
						<AccountListItem
							{account}
							link={false}
							count={transactionCounts[account.id] ?? 0}
							on:keyup={e => toggleAccount(e, account)}
							on:click={e => toggleAccount(e, account)}
						/>
						{#if accountIdsToImport.has(account.id)}
							<Checkmark />
						{/if}
					</li>
				{/each}
			</List>
		</div>
	{/if}

	<div>
		<h4>{$_("settings.import.miscellaneous-items")}</h4>
		<List>
			<li class="importable">
				{#if numberOfLocationsToImport === 1}
					{$_("locations.count.location")}
				{:else}
					{$_("locations.count.locations", {
						values: { n: numberOfLocationsToImport },
					})}
				{/if}
				<Checkmark />
			</li>
			<li class="importable">
				{#if numberOfTagsToImport === 1}
					{$_("tags.count.tag")}
				{:else}
					{$_("tags.count.tags", {
						values: { n: numberOfTagsToImport },
					})}
				{/if}
				<Checkmark />
			</li>
			<li class="importable">
				{#if numberOfAttachmentsToImport === 1}
					{$_("files.count.attachment")}
				{:else}
					{$_("files.count.attachments", { values: { n: numberOfAttachmentsToImport } })}
				{/if}
				<Checkmark />
			</li>
		</List>
	</div>

	<div class="buttons">
		<ActionButton disabled={isImporting || accountIdsToImport.size === 0} on:click={beginImport}>
			{#if isImporting}
				<span
					>{$_("settings.import.in-progress", { values: { percent: importProgressPercent } })}</span
				>
			{:else}
				<span>{$_("settings.import.begin")}</span>
			{/if}
		</ActionButton>
	</div>
</Modal>

<style lang="scss">
	@use "styles/colors" as *;

	.importable {
		display: flex;
		flex-flow: row nowrap;
		align-items: center;

		:global(.icon) {
			margin-left: 8pt;
		}
	}

	.buttons {
		display: flex;
		flex-flow: row wrap;

		:not(:last-child) {
			margin-right: 8pt;
		}

		:global(button) {
			margin-left: auto;
		}
	}
</style>
