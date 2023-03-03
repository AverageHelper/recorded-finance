<script lang="ts">
	import { createEventDispatcher } from "svelte";
	import { navigate } from "svelte-navigator";
	import Chevron from "../icons/Chevron.svelte";

	const dispatch = createEventDispatcher<{
		click: MouseEvent;
		keyup: KeyboardEvent;
	}>();

	type ListItemKind = "add" | "choose";

	export let to: string | null = null;
	export let replace: boolean = false;
	export let title: string;
	export let subtitle: string | null = null;
	export let count: number | string | null = null;
	export let subCount: string | null = null;
	export let negative: boolean = false;
	export let kind: ListItemKind = "choose";

	function onClick(event: KeyboardEvent | MouseEvent) {
		console.debug("onClick", to);
		if (to) {
			navigate(to, { replace });
		} else if ("key" in event) {
			dispatch("keyup", event);
		} else {
			dispatch("click", event);
		}
	}
</script>

<svelte:element
	this={to === null ? "div" : "a"}
	class="list-item {kind} {to !== null ? 'clickable' : ''}"
	href={to}
	on:keyup|stopPropagation|preventDefault={onClick}
	on:click|stopPropagation|preventDefault={onClick}
>
	<slot name="icon" />

	<div class="content">
		<span class="title">{title}</span>
		{#if subtitle}
			<span class="subtitle">{subtitle}</span>
		{/if}
	</div>

	<aside>
		<slot name="aside" />
		<div class="counts">
			{#if count !== null}
				<span class="count {negative ? 'negative' : ''}">{count}</span>
			{/if}
			{#if subCount !== null}
				<span class="subcount">{subCount}</span>
			{/if}
		</div>
	</aside>

	{#if to !== null}
		<Chevron />
	{/if}
</svelte:element>

<style lang="scss" global>
	@use "styles/colors" as *;

	.list-item {
		display: flex;
		flex-flow: row nowrap;
		align-items: center;
		padding: 0.75em;
		width: 100%;
		text-decoration: none;
		border-radius: 4pt;
		color: color($label);
		background-color: color($secondary-fill);

		&.add {
			min-height: 44px;
			color: color($green);

			@media (hover: hover) {
				&:hover {
					color: color($green);
				}
			}
		}

		@media (hover: hover) {
			&.clickable:hover {
				background-color: color($secondary-overlay);
				color: color($label);
				text-decoration: none;
			}
		}

		.content {
			display: flex;
			flex-direction: column;
			margin-left: 4pt;

			.title {
				font-weight: bold;
			}

			.subtitle {
				padding-top: 4pt;
				color: color($secondary-label);
			}
		}

		aside {
			display: flex;
			flex-flow: row wrap;
			align-items: center;
			margin-left: auto;

			span {
				font-weight: bold;
				min-width: 1em;
				text-align: center;
			}

			> :not(:last-child) {
				margin-right: 8pt;
			}

			> .counts {
				display: flex;
				flex-direction: column;
				align-items: flex-end;

				> .count {
					background-color: color($secondary-label);
					color: color($inverse-label);
					border-radius: 1em;
					padding: 0 0.5em;

					&.negative {
						background-color: color($red);
					}
				}

				> .subcount {
					font-size: small;
					color: color($secondary-label);
					margin-top: 4pt;
					padding: 0 0.5em;
				}
			}
		}

		// Chevron
		> :last-child {
			color: color($separator);
			margin-left: 8pt;
			user-select: none;
		}
	}
</style>
