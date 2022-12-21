<script lang="ts">
	import type { Transaction } from "../../model/Transaction";
	import { _, locale } from "../../i18n";
	import { allBalances, attachments, handleError, updateTransaction } from "../../store";
	import { isNegative as isDineroNegative } from "dinero.js";
	import { onMount } from "svelte";
	import { toCurrency, toTimestamp } from "../../transformers";
	import { transaction as newTransaction } from "../../model/Transaction";
	import { transactionPath } from "../../router";
	import ListItem from "../../components/ListItem.svelte";
	import LocationIcon from "../../icons/Location.svelte";
	import PaperclipIcon from "../../icons/Paperclip.svelte";
	import StylizedCheckbox from "../../components/inputs/StylizedCheckbox.svelte";

	export let transaction: Transaction;

	let isChangingReconciled = false;
	$: isNegative = isDineroNegative(transaction.amount);
	$: hasAttachments = transaction.attachmentIds.length > 0;

	let isAttachmentBroken: boolean | "unknown" = "unknown";
	$: hasLocation = transaction.locationId !== null;
	$: timestamp = toTimestamp($locale.code, transaction.createdAt);

	$: accountBalanceSoFar = ($allBalances[transaction.accountId] ?? {})[transaction.id] ?? null;

	$: transactionRoute = transactionPath(transaction.accountId, transaction.id);

	function seeIfAnyAttachmentsAreBroken() {
		if (isAttachmentBroken !== "unknown") return;
		const attachmentIds = transaction.attachmentIds;

		// Check if an attachment is broken
		for (const id of attachmentIds) {
			const file = $attachments[id];
			if (!file) {
				isAttachmentBroken = true;
				return;
			}
		}

		isAttachmentBroken = false;
	}

	onMount(() => {
		seeIfAnyAttachmentsAreBroken();
	});

	async function setReconciled(isReconciled: boolean) {
		try {
			const newTxn = newTransaction(transaction);
			newTxn.isReconciled = isReconciled;
			await updateTransaction(newTxn);
		} catch (error) {
			handleError(error);
		}
	}

	async function markReconciled(isReconciled: CustomEvent<boolean>) {
		isChangingReconciled = true;

		await setReconciled(isReconciled.detail);

		isChangingReconciled = false;
	}
</script>

<ListItem
	to={transactionRoute}
	title={transaction.title ?? "--"}
	subtitle={timestamp}
	count={toCurrency($locale.code, transaction.amount)}
	subCount={accountBalanceSoFar ? toCurrency($locale.code, accountBalanceSoFar) : "--"}
	negative={isNegative}
>
	<div slot="icon">
		<StylizedCheckbox
			loading={isChangingReconciled}
			value={transaction.isReconciled}
			on:change={markReconciled}
		/>
	</div>

	<div slot="aside" class="indicators">
		{#if hasLocation}
			<div title={transaction.locationId ?? ""}>
				<LocationIcon />
			</div>
		{/if}
		{#if hasAttachments}
			<div
				title={transaction.attachmentIds.length === 1
					? $_("files.count.attachment")
					: $_("files.count.attachments", { values: { n: transaction.attachmentIds.length } })}
			>
				{#if isAttachmentBroken}
					<strong>?</strong>
				{/if}
				<PaperclipIcon />
			</div>
		{/if}
	</div>
</ListItem>

<style lang="scss">
	@use "styles/colors" as *;

	.indicators {
		display: flex;
		flex-flow: row wrap;
		color: color($secondary-label);

		:not(:last-child) {
			margin-bottom: 2pt;
		}
	}
</style>
