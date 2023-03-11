<script lang="ts">
	import { _ } from "../../i18n";
	import ChangePasswordForm from "./ChangePasswordForm.svelte";
	import ChangeAccountIdForm from "./ChangeAccountIdForm.svelte";
	import DeleteData from "./DeleteData.svelte";
	import Exports from "./Exports.svelte";
	import Import from "./Import.svelte";
	import MfaForm from "./MfaForm.svelte";
</script>

<main class="content">
	<div class="heading">
		<h1>{$_("settings.heading")}</h1>
	</div>

	<MfaForm />
	<hr />
	<ChangeAccountIdForm />
	<hr />
	<ChangePasswordForm />
	<hr />
	<Import />
	<hr />
	<Exports />
	<hr />
	<DeleteData />
</main>

<style lang="scss">
	.heading {
		max-width: 36em;
		margin: 1em auto;

		> h1 {
			margin: 0;
		}
	}
</style>
