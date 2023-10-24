<script lang="ts">
	import { _ } from "../../i18n";
	import { transactionsByMonth } from "../../router/routes";
	import ListItem from "../../components/ListItem.svelte";
	import MonthIcon from "../../icons/Month.svelte";

	export let accountId: string;
	export let monthName: string;
	export let count: number;

	$: monthRoute = transactionsByMonth(accountId, encodeURIComponent(monthName));
</script>

<ListItem
	to={monthRoute}
	title={monthName}
	subtitle={$_("transactions.count.transactions", { values: { n: count } })}
>
	<MonthIcon slot="icon" />
</ListItem>

<style lang="scss">
	@use "styles/colors" as *;

	:global(.list-item .icon) {
		margin: 4pt;
	}
</style>
