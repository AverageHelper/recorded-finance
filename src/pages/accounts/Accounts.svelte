<script lang="ts">
	import { _ } from "../../i18n";
	import { onMount } from "svelte";
	import AccountEdit from "./AccountEdit.svelte";
	import AccountListItem from "./AccountListItem.svelte";
	import ActionButton from "../../components/buttons/ActionButton.svelte";
	import AddRecordListItem from "./AddRecordListItem.svelte";
	import ErrorNotice from "../../components/ErrorNotice.svelte";
	import List from "../../components/List.svelte";
	import ListItem from "../../components/ListItem.svelte";
	import Modal from "../../components/Modal.svelte";
	import NewLoginModal from "../../components/NewLoginModal.svelte";
	import ReloadIcon from "../../icons/Reload.svelte";
	import Spinner from "../../components/Spinner.svelte";
	import {
		accountsLoadError,
		allAccounts,
		isLoadingAccounts,
		numberOfAccounts,
		watchAccounts,
		watchAttachments,
		watchLocations,
		watchTags,
		watchTransactions,
	} from "../../store";

	let isCreatingAccount = false;

	async function load() {
		console.debug("Starting watchers...");
		await Promise.all([
			watchAccounts(), //
			watchAttachments(),
			watchLocations(),
			watchTags(),
			watchTransactions(),
		]);
	}

	onMount(async () => {
		await load();
	});

	function startCreatingAccount(event: CustomEvent<MouseEvent> | CustomEvent<KeyboardEvent>) {
		if ("key" in event.detail && event.detail.key !== " ") return;
		isCreatingAccount = true;
	}

	function finishCreatingAccount() {
		isCreatingAccount = false;
	}
</script>

<main class="content">
	<div class="heading">
		<h1>Accounts</h1>
	</div>

	<ErrorNotice error={$accountsLoadError} />
	{#if $accountsLoadError}
		<ActionButton kind="info" on:click={load}>
			<ReloadIcon />
			Retry
		</ActionButton>
	{:else}
		<List>
			<li>
				<AddRecordListItem
					noun="account"
					on:keydown={startCreatingAccount}
					on:click={startCreatingAccount}
				/>
			</li>
			{#if $isLoadingAccounts}
				<li>
					<ListItem title={$_("common.loading-in-progress")}>
						<Spinner slot="icon" />
					</ListItem>
				</li>
			{/if}
			{#each $allAccounts as account (account.id)}
				<li>
					<AccountListItem {account} />
				</li>
			{/each}
			{#if $numberOfAccounts > 0}
				<li>
					<p class="footer"
						>{$numberOfAccounts === 1
							? $_("accounts.count.account")
							: $_("accounts.count.accounts", { values: { n: $numberOfAccounts } })}</p
					>
				</li>
			{/if}
		</List>
	{/if}
</main>

<NewLoginModal />

<Modal open={isCreatingAccount} closeModal={finishCreatingAccount}>
	<AccountEdit on:finished={finishCreatingAccount} />
</Modal>

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
