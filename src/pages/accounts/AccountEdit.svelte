<script lang="ts">
	import type { Account } from "../../model/Account";
	import { _ } from "../../i18n";
	import { account as newAccount } from "../../model/Account";
	import { createEventDispatcher, onMount } from "svelte";
	import ActionButton from "../../components/buttons/ActionButton.svelte";
	import Form from "../../components/Form.svelte";
	import TextAreaField from "../../components/inputs/TextAreaField.svelte";
	import TextField from "../../components/inputs/TextField.svelte";
	import {
		createAccount,
		deleteAccount as _deleteAccount,
		handleError,
		transactionsForAccount,
		updateAccount,
	} from "../../store";

	const dispatch = createEventDispatcher<{
		deleted: void;
		finished: void;
	}>();

	export let account: Account | null = null;

	$: isCreatingAccount = account === null;
	$: numberOfTransactions = !account
		? 0
		: Object.keys($transactionsForAccount[account.id] ?? {}).length;

	let isLoading = false;
	let title = "";
	let notes = "";
	// $: createdAt = account.createdAt ?? new Date();

	let titleField: TextField | undefined;

	onMount(() => {
		// Opened, if we're modal
		title = account?.title ?? "";
		notes = account?.notes ?? "";
		titleField?.focus();
	});

	async function submit() {
		isLoading = true;

		try {
			if (!title) {
				throw new Error($_("error.form.missing-required-fields"));
			}

			if (account === null) {
				await createAccount({
					createdAt: new Date(),
					title: title.trim(),
					notes: notes.trim(),
				});
			} else {
				await updateAccount(
					newAccount({
						id: account.id,
						title: title.trim(),
						notes: notes.trim() || (account.notes?.trim() ?? null),
						createdAt: account.createdAt,
					})
				);
			}

			dispatch("finished");
		} catch (error) {
			handleError(error);
		}

		isLoading = false;
	}

	async function deleteAccount(event: Event) {
		event.preventDefault();
		isLoading = true;

		try {
			if (account === null) {
				throw new Error($_("accounts.cannot-delete-none-found"));
			}

			await _deleteAccount(account);
			dispatch("deleted");
			dispatch("finished");
		} catch (error) {
			handleError(error);
		}

		isLoading = false;
	}
</script>

<Form class="form-d8a5e2ee" on:submit={submit}>
	{#if isCreatingAccount}
		<h1>{$_("accounts.create")}</h1>
	{:else}
		<h1
			>{$_("accounts.edit-titled", {
				values: { title: account?.title ?? $_("accounts.noun") },
			})}</h1
		>
	{/if}

	<TextField
		bind:this={titleField}
		value={title}
		label={$_("accounts.meta.title")}
		placeholder={$_("example.income-transaction-title")}
		required
		on:input={e => (title = e.detail)}
	/>
	<TextAreaField
		value={notes}
		label={$_("accounts.meta.notes")}
		placeholder={$_("example.transaction-note")}
		on:input={e => (notes = e.detail)}
	/>

	<ActionButton type="submit" kind="bordered-primary" disabled={isLoading}
		>{$_("common.save-imperative")}</ActionButton
	>
	{#if !isCreatingAccount && numberOfTransactions === 0}
		<ActionButton kind="bordered-destructive" disabled={isLoading} on:click={deleteAccount}
			>{$_("accounts.delete-titled", {
				values: { title: account?.title ?? $_("accounts.noun") },
			})}</ActionButton
		>
	{/if}
	{#if isLoading}
		<p>{$_("common.saving-in-progress")}</p>
	{/if}
</Form>

<style lang="scss" global>
	.form-d8a5e2ee {
		align-items: center;

		> label {
			width: 80%;
		}
	}
</style>
