<script lang="ts">
	import type { Transaction } from "../../model/Transaction";
	import { _, locale } from "../../i18n";
	import { isNegative as isDineroNegative } from "dinero.js";
	import { reverseChronologically } from "../../model/utility/sort";
	import { toCurrency } from "../../transformers";
	import { useLocation, useNavigate } from "svelte-navigator";
	import { zeroDinero } from "../../helpers/dineroHelpers";
	import AccountEdit from "./AccountEdit.svelte";
	import AddRecordListItem from "./AddRecordListItem.svelte";
	import EditButton from "../../components/buttons/EditButton.svelte";
	import Fuse from "fuse.js";
	import List from "../../components/List.svelte";
	import ListItem from "../../components/ListItem.svelte";
	import SearchBar from "../../components/SearchBar.svelte";
	import Spinner from "../../components/Spinner.svelte";
	import TransactionCreateModal from "../transactions/TransactionCreateModal.svelte";
	import TransactionMonthListItem from "../transactions/TransactionMonthListItem.svelte";
	import TransactionListItem from "../transactions/TransactionListItem.svelte";
	import {
		accounts,
		currentBalance,
		isLoadingTransactions,
		months,
		transactionsForAccount,
		transactionsForAccountByMonth,
		watchTransactions,
	} from "../../store";

	export let accountId: string;

	const location = useLocation();
	const navigate = useNavigate();

	let isEditingTransaction = false;

	$: account = $accounts[accountId] ?? null;
	$: theseTransactions = Object.values($transactionsForAccount[accountId] ?? {}) //
		.sort(reverseChronologically);

	let transactionMonths: Array<[string, Array<Transaction>]>;
	$: {
		const now = new Date();
		transactionMonths = Object.entries($transactionsForAccountByMonth[accountId] ?? {}).sort(
			([monthId1], [monthId2]) => {
				// Look up the month's cached start date
				const a = $months[monthId1];
				const b = $months[monthId2];

				if (!a) console.warn(`Month ${monthId1} (a) doesn't exist in cache`);
				if (!b) console.warn(`Month ${monthId2} (b) doesn't exist in cache`);

				const aStart = a?.start ?? now;
				const bStart = b?.start ?? now;
				// Order reverse chronologically
				return bStart.getTime() - aStart.getTime();
			}
		);
	}

	$: searchClient = new Fuse(theseTransactions, { keys: ["title", "notes"] });
	$: queryParams = new URLSearchParams($location.search);
	$: searchQuery = (queryParams.get("q") ?? "").toString();
	$: filteredTransactions =
		searchQuery !== "" //
			? searchClient.search(searchQuery).map(r => r.item)
			: theseTransactions;

	$: remainingBalance = $currentBalance[accountId] ?? null;
	$: isNegative = isDineroNegative(remainingBalance ?? zeroDinero);

	$: account && void watchTransactions(account);

	function goBack() {
		navigate(-1);
	}

	function startCreatingTransaction(event: CustomEvent<MouseEvent> | CustomEvent<KeyboardEvent>) {
		if ("key" in event.detail && event.detail.key !== " ") return;
		isEditingTransaction = true;
	}

	function finishCreatingTransaction() {
		isEditingTransaction = false;
	}
</script>

<main class="content account-view">
	<div class="heading">
		<div class="account-title-1dfc4112">
			<h1>{account?.title || $_("accounts.noun")}</h1>
			<EditButton>
				<AccountEdit
					slot="modal"
					let:onFinished
					{account}
					on:deleted={goBack}
					on:finished={onFinished}
				/>
			</EditButton>
		</div>

		{#if remainingBalance === null}
			<p class="account-balance">--</p>
		{:else}
			<p class="account-balance {isNegative ? 'negative' : ''}"
				>{toCurrency($locale.code, remainingBalance)}</p
			>
		{/if}
	</div>

	<SearchBar />

	<!-- Search Results -->
	{#if searchQuery}
		<List>
			{#each filteredTransactions as transaction (transaction.id)}
				<li class="transaction">
					<TransactionListItem {transaction} />
				</li>
			{/each}
			<li>
				<p class="footer"
					>{$_("transactions.n-of-n-count", {
						values: { c: filteredTransactions.length, t: theseTransactions.length },
					})}</p
				>
			</li>
		</List>

		<!-- Months (normal view) -->
	{:else}
		<List>
			<li>
				<AddRecordListItem
					on:keyup={startCreatingTransaction}
					on:click={startCreatingTransaction}
				/>
			</li>
			{#if $isLoadingTransactions}
				<li>
					<ListItem title={$_("common.loading-in-progress")}>
						<Spinner slot="icon" />
					</ListItem>
				</li>
			{/if}
			{#each transactionMonths as [month, monthTransactions] (month)}
				<li>
					<TransactionMonthListItem
						{accountId}
						monthName={month}
						count={monthTransactions.length}
					/>
				</li>
			{/each}
		</List>
	{/if}
</main>

{#if account}
	<TransactionCreateModal
		{account}
		isOpen={isEditingTransaction}
		closeModal={finishCreatingTransaction}
	/>
{/if}

<style lang="scss" global>
	@use "styles/colors" as *;

	.heading {
		display: flex;
		flex-flow: row nowrap;
		align-items: baseline;
		max-width: 36em;
		margin: 1em auto;

		> .account-title-1dfc4112 {
			display: flex;
			flex-flow: row nowrap;
			align-items: center;

			> h1 {
				margin: 0;
			}

			:global(button) {
				display: flex;
				flex-flow: row nowrap;
				align-items: center;
				color: color($link);
				min-height: 22pt;
				height: 22pt;
				min-width: 22pt;
				width: 22pt;
				margin-left: 8pt;

				.icon {
					height: 14pt;
				}
			}
		}

		.account-balance {
			margin: 0;
			margin-left: auto;
			text-align: right;
			font-weight: bold;
			padding-right: 0.7em;

			&.negative {
				color: color($red);
			}
		}
	}

	:global(.search) {
		max-width: 36em;
		margin: 1em auto;
	}

	.account-view {
		:global(ul) {
			.footer {
				padding-top: 0.5em;
				user-select: none;
				color: color($secondary-label);
			}
		}
	}
</style>
