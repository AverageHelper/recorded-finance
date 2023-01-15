<script lang="ts">
	import ActionButton from "./ActionButton.svelte";
	import EditIcon from "../../icons/Edit.svelte";
	import Modal from "../Modal.svelte";

	let isOpen = false;

	function closeModal() {
		isOpen = false;
	}

	function toggle() {
		isOpen = !isOpen;
	}
</script>

<div class="edit-button">
	<ActionButton kind="plain" on:click={toggle}>
		<slot name="icon">
			<EditIcon />
		</slot>
	</ActionButton>
</div>

<Modal open={isOpen} {closeModal}>
	<slot name="modal" onFinished={closeModal} />
</Modal>

<style lang="scss">
	@use "styles/colors" as *;

	:global(.edit-button) {
		display: flex;
		flex-flow: row nowrap;
		align-items: center;
		color: color($link);
		min-height: 22pt;
		height: 22pt;
		min-width: 22pt;
		width: 22pt;

		:global(.icon) {
			height: 14pt;
		}
	}
</style>
