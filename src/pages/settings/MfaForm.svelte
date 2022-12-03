<script lang="ts">
	import { _ } from "../../i18n";
	import { currentUser } from "../../store/authStore";
	import ActionButton from "../../components/buttons/ActionButton.svelte";
	import Form from "../../components/Form.svelte";
	import MfaEnrollModal from "./MfaEnrollModal.svelte";
	import MfaUnenrollModal from "./MfaUnenrollModal.svelte";

	$: isEnrolled = $currentUser?.mfa.includes("totp") === true;

	let isEnrollingMfa = false;
	let isUnenrollingMfa = false;

	function enroll() {
		isEnrollingMfa = true;
	}

	function unenroll() {
		isUnenrollingMfa = true;
	}

	function closeModals() {
		isEnrollingMfa = false;
		isUnenrollingMfa = false;
	}
</script>

<Form>
	<h3>{$_("settings.mfa.general.heading")}</h3>
	<p>{$_("settings.mfa.general.explanation")}</p>

	{#if isEnrolled}
		<ActionButton kind="info" on:click={unenroll}
			>{$_("settings.mfa.general.unenroll-action")}</ActionButton
		>
	{:else}
		<ActionButton kind="info" on:click={enroll}
			>{$_("settings.mfa.general.enroll-action")}</ActionButton
		>
	{/if}

	<MfaEnrollModal isOpen={isEnrollingMfa} on:finished={closeModals} />
	<MfaUnenrollModal isOpen={isUnenrollingMfa} on:finished={closeModals} />
</Form>
