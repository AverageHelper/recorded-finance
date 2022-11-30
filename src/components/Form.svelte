<script lang="ts">
	import { createEventDispatcher } from "svelte";
	import { Form } from "sveltestrap";

	const dispatch = createEventDispatcher<{
		submit: WindowEventMap["submit"];
	}>();

	function onSubmit(event: WindowEventMap["submit"]) {
		event.preventDefault();
		dispatch("submit", event);
	}
</script>

<Form on:submit={onSubmit}>
	<slot />
</Form>
