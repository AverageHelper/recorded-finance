<script lang="ts">
	import ActionButton from "./ActionButton.svelte";
</script>

<div class="tiny-button">
	<ActionButton kind="plain">
		<slot />
	</ActionButton>
</div>

<style lang="scss">
	@use "styles/colors" as *;

	div.tiny-button {
		min-height: 12pt;
		min-width: 12pt;
		font-size: small;
		text-align: center;

		@media (hover: hover) {
			&:hover {
				background-color: color($transparent-gray);
			}
		}
	}
</style>
