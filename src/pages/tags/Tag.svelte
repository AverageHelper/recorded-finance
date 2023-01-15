<script lang="ts">
	import type { Tag } from "../../model/Tag";
	import { numberOfReferencesForTag } from "../../store";
	import ActionButton from "../../components/buttons/ActionButton.svelte";
	import XIcon from "../../icons/X.svelte";

	export let tag: Tag;
	export let showsCount: boolean = false;
	export let onSelect: ((tag: Tag) => void) | null = null;
	export let onRemove: ((tag: Tag) => void) | null = null;

	$: count = numberOfReferencesForTag(tag.id);
</script>

<div
	class={`tag tag--${tag.colorId} ${onSelect ? "selectable" : ""}`}
	title={tag.id}
	on:click={() => onSelect && onSelect(tag)}
>
	<span class="title">{tag.name}</span>

	<slot />

	{#if showsCount}
		<p class="count">{count}</p>
	{/if}
	{#if onRemove}
		<!-- FIXME: This is crap on mobile -->
		<ActionButton kind="plain" on:click={() => onRemove && onRemove(tag)}>
			<!-- &times; -->
			<XIcon />
		</ActionButton>
	{/if}
</div>

<style lang="scss">
	@use "styles/colors" as *;

	.tag {
		display: flex;
		flex-flow: row nowrap;
		align-items: center;
		margin-right: 0.5em;
		margin-bottom: 0.4em;
		padding: 0 0.5em;
		padding-right: 0.4em; // right wall was too thick for the round button
		color: color($label-dark);
		border-radius: 1em;
		min-width: min-content;
		text-align: left;
		font-weight: bold;
		cursor: default;

		&.selectable {
			cursor: pointer;

			@media (hover: hover) {
				&:hover .title {
					text-decoration: underline;
				}
			}
		}

		&::before {
			content: "#";
		}

		.title {
			margin-right: 0.25em;
		}

		.count {
			margin: 0.2em 0;
			margin-left: auto;
			padding: 0 0.4em;
			min-width: 1.5em;
			border-radius: 1em;
			text-align: center;
			background-color: color($transparent-gray);
		}

		> :global(button) {
			position: relative;
			color: color($label);
			text-decoration: none;
			min-height: 12pt;
			min-width: 12pt;
			border-radius: 12pt;
			padding: 0;
			margin: 0;
			display: none; // hide until hovering over the tag item

			@media (hover: hover) {
				&:hover {
					background-color: color($transparent-gray);
					color: color($label);
				}
			}

			> :global(.icon) {
				position: absolute;
				top: 50%;
				left: 50%;
				transform: translate(-50%, -50%);
				height: 6pt;
			}
		}

		// Show the 'x' button while hovering over the tag item
		@media (hover: hover) {
			&:hover {
				:global(button) {
					display: inline-block;
				}
			}
		}

		&--red {
			background-color: color($red);
		}
		&--orange {
			background-color: color($orange);
			color: color($label-light);
		}
		&--yellow {
			background-color: color($yellow);
			color: color($label-light);
		}
		&--green {
			background-color: color($green);
		}
		&--blue {
			background-color: color($blue);
		}
		&--purple {
			background-color: color($purple);
		}
	}
</style>
