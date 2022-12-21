<script lang="ts">
	import type { Account } from "../../model/Account";
	import type { Location, PendingLocation } from "../../model/Location";
	import type { Transaction, TransactionRecordParams } from "../../model/Transaction";
	import { _, locale } from "../../i18n";
	import { createEventDispatcher, onMount } from "svelte";
	import { equal, isNegative, isZero, toSnapshot } from "dinero.js";
	import { recordFromLocation } from "../../model/Location";
	import { transaction as newTransaction } from "../../model/Transaction";
	import { zeroDinero } from "../../helpers/dineroHelpers";
	import ActionButton from "../../components/buttons/ActionButton.svelte";
	import Checkbox from "../../components/inputs/Checkbox.svelte";
	import CheckmarkIcon from "../../icons/Checkmark.svelte";
	import ConfirmDestroyTransaction from "./ConfirmDestroyTransaction.svelte";
	import CurrencyInput from "../../components/inputs/CurrencyInput.svelte";
	import DateTimeInput from "../../components/inputs/DateTimeInput.svelte";
	import Form from "../../components/Form.svelte";
	import LocationField from "../locations/LocationField.svelte";
	import TextAreaField from "../../components/inputs/TextAreaField.svelte";
	import TextField from "../../components/inputs/TextField.svelte";
	import TrashIcon from "../../icons/Trash.svelte";
	import {
		createLocation,
		createTransaction,
		deleteLocation,
		deleteTransaction,
		handleError,
		locations,
		numberOfReferencesForLocation,
		updateTransaction,
	} from "../../store";

	const dispatch = createEventDispatcher<{
		deleted: void;
		finished: void;
	}>();

	export let account: Account;
	export let transaction: Transaction | null = null;

	$: ogTransaction = transaction;
	$: ogLocation =
		ogTransaction?.locationId !== null && ogTransaction?.locationId !== undefined
			? $locations[ogTransaction.locationId] ?? null
			: null;
	$: isCreatingTransaction = ogTransaction === null;

	let isLoading = false;
	let title = "";
	let notes = "";
	let locationData: PendingLocation | null = null;
	let createdAt = new Date();
	let amount = zeroDinero;
	let isReconciled = false;

	let isAskingToDelete = false;
	$: isExpense = isNegative(amount) || isZero(amount);
	$: hasAttachments = (ogTransaction?.attachmentIds.length ?? 0) > 0;

	$: oldAmount = (ogTransaction?.amount ?? zeroDinero).toJSON();
	$: hasChanges = ogTransaction
		? createdAt !== (ogTransaction?.createdAt ?? new Date()) ||
		  title !== (ogTransaction?.title ?? "") ||
		  notes !== (ogTransaction?.notes ?? "") ||
		  amount.toJSON().amount !== oldAmount.amount ||
		  amount.toJSON().currency.code !== oldAmount.currency.code ||
		  isReconciled !== (ogTransaction?.isReconciled ?? false) ||
		  locationData?.title !== ogLocation?.title ||
		  locationData?.title !== ogLocation?.title ||
		  locationData?.subtitle !== ogLocation?.subtitle ||
		  locationData?.coordinate?.lat !== ogLocation?.coordinate?.lat ||
		  locationData?.coordinate?.lng !== ogLocation?.coordinate?.lng
		: title !== "" ||
		  notes !== "" ||
		  !equal(amount, zeroDinero) ||
		  isReconciled !== false ||
		  (locationData?.title ?? "") !== "" ||
		  (locationData?.subtitle ?? "") !== "" ||
		  (locationData?.coordinate?.lat ?? null) !== null ||
		  (locationData?.coordinate?.lng ?? null) !== null;

	$: createdAt.setSeconds(0, 0);

	onMount(() => {
		// Modal invocations call this. This is good.

		title = ogTransaction?.title ?? title;
		notes = ogTransaction?.notes ?? notes;
		createdAt = ogTransaction?.createdAt ?? createdAt;
		amount = ogTransaction?.amount ?? amount;
		isReconciled = ogTransaction?.isReconciled ?? isReconciled;

		const ogLocationId = ogTransaction?.locationId ?? null;
		if (ogLocationId !== null && ogLocationId) {
			const ogLocation = $locations[ogLocationId];
			const ogRecord = ogLocation ? recordFromLocation(ogLocation) : null;
			locationData =
				ogRecord !== null
					? {
							coordinate: ogRecord.coordinate
								? {
										lat: ogRecord.coordinate.lat,
										lng: ogRecord.coordinate.lng,
								  }
								: null,
							id: ogLocationId,
							lastUsed: ogRecord.lastUsed,
							subtitle: ogRecord.subtitle,
							title: ogRecord.title,
					  }
					: null;
		}
	});

	function onLocationUpdate(event: CustomEvent<PendingLocation | null>) {
		locationData = event.detail;
	}

	async function submit() {
		isLoading = true;

		try {
			if (!title.trim()) {
				throw new Error($_("error.form.missing-required-fields"));
			}

			// Handle location change (to another or to none)
			//  Unlink the old and delete it if unreferenced
			const ogLocationId = ogTransaction?.locationId ?? null;
			if (ogLocationId !== null) {
				// The next step will replace the location link
				// Just delete the location if this is the only transaction which references it
				const ogLocation = $locations[ogLocationId];
				if (ogLocation) {
					const referenceCount = numberOfReferencesForLocation(ogLocation.id);
					if (referenceCount > 1) {
						await deleteLocation(ogLocation);
					}
				}
			}

			// Handle location add
			//  Link the new location (if `id` isn't null), or make one
			let newLocation: Location | null = null;
			if (locationData) {
				if (locationData.id !== null) {
					// Existing location
					newLocation = $locations[locationData.id] ?? null;
				} else {
					// New location
					newLocation = await createLocation(locationData);
				}
			}

			const params: TransactionRecordParams = {
				title: title.trim(),
				notes: notes.trim(),
				createdAt: createdAt,
				isReconciled: isReconciled,
				locationId: newLocation?.id ?? null,
				amount: toSnapshot(amount),
				accountId: account.id,
				tagIds: ogTransaction?.tagIds ?? [],
				attachmentIds: ogTransaction?.attachmentIds ?? [],
			};
			if (ogTransaction === null) {
				await createTransaction(params);
			} else {
				await updateTransaction(
					newTransaction({
						id: ogTransaction.id,
						accountId: params.accountId,
						amount: params.amount,
						attachmentIds: params.attachmentIds.slice(),
						createdAt: params.createdAt,
						isReconciled: params.isReconciled,
						locationId: params.locationId,
						notes: params.notes,
						objectType: "Transaction",
						tagIds: params.tagIds.slice(),
						title: params.title,
					})
				);
			}

			dispatch("finished");
		} catch (error) {
			handleError(error);
		}

		isLoading = false;
	}

	function askToDeleteTransaction(event: Event) {
		event.preventDefault();
		isAskingToDelete = true;
	}

	async function confirmDeleteTransaction() {
		isLoading = true;

		try {
			if (ogTransaction === null) {
				throw new Error($_("accounts.cannot-delete-none-found"));
			}

			await deleteTransaction(ogTransaction);
			dispatch("deleted");
			dispatch("finished");
		} catch (error) {
			handleError(error);
		}

		isLoading = false;
	}

	function cancelDeleteTransaction() {
		isAskingToDelete = false;
	}
</script>

<Form on:submit={submit}>
	{#if isCreatingTransaction}
		{#if isExpense}
			<h1 class={isExpense ? "expense" : undefined}>{$_("transactions.create.expense")}</h1>
		{:else}
			<h1 class={isExpense ? "expense" : undefined}>{$_("transactions.create.income")}</h1>
		{/if}
	{:else if isExpense}
		<h1>{$_("transactions.edit.expense")}</h1>
	{:else}
		<h1>{$_("transactions.edit.income")}</h1>
	{/if}

	<p>Account: {account.title ?? $_("accounts.unknown-title")}</p>

	<TextField
		value={title}
		label={$_("transactions.meta.title").toLocaleLowerCase($locale.code)}
		placeholder={$_("example.income-transaction-title")}
		required
		on:input={e => (title = e.detail)}
	/>
	<CurrencyInput
		value={amount}
		label={$_("transactions.meta.amount").toLocaleLowerCase($locale.code)}
		on:input={e => (amount = e.detail)}
	/>
	<Checkbox
		value={isReconciled}
		label={$_("transactions.meta.reconciled")}
		on:change={e => (isReconciled = e.detail)}
	/>
	<DateTimeInput
		value={createdAt}
		label={$_("transactions.meta.date")}
		on:input={e => (createdAt = e.detail)}
	/>
	<LocationField value={locationData} on:change={onLocationUpdate} />
	<TextAreaField
		value={notes}
		label={$_("transactions.meta.notes").toLocaleLowerCase($locale.code)}
		placeholder={$_("example.transaction-note")}
		on:input={e => (notes = e.detail)}
	/>

	<div class="buttons">
		<ActionButton type="submit" disabled={!hasChanges || isLoading}>
			<CheckmarkIcon />
			{#if !isLoading}
				<span>{$_("common.save-imperative")}</span>
			{:else}
				<span>{$_("common.saving-in-progress")}</span>
			{/if}
		</ActionButton>
		{#if !isCreatingTransaction && !hasAttachments}
			<ActionButton kind="destructive" disabled={isLoading} on:click={askToDeleteTransaction}>
				<TrashIcon />
				<span>{$_("common.delete-imperative")}</span>
			</ActionButton>
		{/if}
	</div>
	{#if hasAttachments}
		<p>{$_("transactions.delete.detach-first")}</p>
	{/if}

	{#if transaction}
		<ConfirmDestroyTransaction
			{transaction}
			isOpen={isAskingToDelete}
			on:yes={confirmDeleteTransaction}
			on:no={cancelDeleteTransaction}
		/>
	{/if}
</Form>

<style lang="scss">
	@use "styles/colors" as *;

	:global(form) {
		align-items: center;
		text-align: center;

		p {
			text-align: center; // "Account" temp indicator should be centered
		}

		> :global(*) {
			width: 100%; // fields etc. should be the same width
		}

		:global(.checkbox) {
			width: initial; // checkbox shouldn't be so wide
		}

		h1.expense {
			color: color($red);
		}
	}
</style>
