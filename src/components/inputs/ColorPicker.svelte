<script lang="ts">
	import type { ColorID } from "../../model/Color";
	import { allColors as colors } from "../../model/Color";
	import { createEventDispatcher } from "svelte";
	import ColorDot from "./../ColorDot.svelte";
	import List from "./../List.svelte";

	const dispatch = createEventDispatcher<{ change: ColorID }>();

	export let value: ColorID | null = null;

	function select(colorId: ColorID) {
		dispatch("change", colorId);
	}

	function onKeyup(event: CustomEvent<KeyboardEvent>, colorId: ColorID) {
		if (event.detail.key !== " ") return;
		event.stopPropagation();
		select(colorId);
	}
</script>

<div class="color-picker">
	<List>
		{#each colors as colorId}
			<li class={colorId === value ? "selected" : ""}>
				<ColorDot {colorId} on:keyup={e => onKeyup(e, colorId)} on:click={() => select(colorId)}>
					<div class="check" />
				</ColorDot>
			</li>
		{/each}
	</List>
</div>

<style lang="scss" global>
	@use "styles/colors" as *;

	:global(.color-picker ul) {
		display: flex;
		flex-flow: row wrap;
		align-items: center;
		justify-content: center;
		min-height: 4.5em;

		li {
			margin-left: 0.5em;

			.dot {
				cursor: pointer;
				width: 3em;
				height: 3em;
				transition-property: width, height;
				transition-duration: 0.23s;
				display: flex;
				align-items: center;
				justify-content: center;

				.check {
					border-radius: 50%;
					width: 0;
					height: 0;
					transition-property: width, height, background-color;
					transition-duration: 0.23s;
					background-color: color($background);
				}

				&:focus {
					outline: none;
					width: 2.5em;
					height: 2.5em;
				}
			}

			&.selected {
				.dot {
					width: 4em;
					height: 4em;

					.check {
						width: 1em;
						height: 1em;
					}
				}
			}
		}

		li:first-child {
			margin: 0;
		}
	}
</style>
