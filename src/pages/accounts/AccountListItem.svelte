<script lang="ts">
	import type { Account } from "../../model/Account";
	import { _, locale } from "../../i18n";
	import { accountPath } from "../../router";
	import { currentBalance, getTransactionsForAccount, transactionsForAccount } from "../../store";
	import { isNegative as isDineroNegative } from "dinero.js";
	import { onMount } from "svelte";
	import { toCurrency } from "../../transformers";
	import ListItem from "../../components/ListItem.svelte";

	export let account: Account;
	export let link: boolean = true;
	export let count: number | null = null;

	$: accountRoute = link ? accountPath(account.id) : "#";
	$: theseTransactions = $transactionsForAccount[account.id];

	$: remainingBalance = $currentBalance[account.id] ?? null;
	$: isBalanceNegative = remainingBalance !== null && isDineroNegative(remainingBalance);

	$: numberOfTransactions =
		theseTransactions === undefined
			? count ?? null
			: count ?? Object.keys(theseTransactions).length;

	$: notes = account.notes?.trim() ?? "";
	$: countString =
		numberOfTransactions === 1
			? $_("transactions.count.transaction")
			: $_("transactions.count.transactions", { values: { n: numberOfTransactions ?? "?" } });
	$: subtitle = !notes
		? countString
		: numberOfTransactions === null
		? notes
		: `${countString} - ${notes}`;

	onMount(async () => {
		await getTransactionsForAccount(account);
	});
</script>

<ListItem
	to={accountRoute}
	title={account.title}
	{subtitle}
	count={remainingBalance ? toCurrency($locale.code, remainingBalance) : "--"}
	negative={isBalanceNegative}
	class={$$props["class"]}
	on:click
/>
