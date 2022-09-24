<script lang="ts">
	import { _ } from "../../i18n";
	import { currentUser } from "../../store/authStore";
	import ActionButton from "../../components/buttons/ActionButton.svelte";
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

<!-- TODO: I18N -->
<form on:submit|preventDefault>
	<h3>Multi-factor Authentication</h3>
	<p
		>Your password is a single authentication factor ("what you know"). Adding a second factor
		("what you have" or "what you are") increases your account's security by, like, a lot.</p
	>

	{#if isEnrolled}
		<ActionButton kind="bordered" on:click={unenroll}>Unenroll 2FA</ActionButton>
	{:else}
		<ActionButton kind="bordered" on:click={enroll}>Enroll 2FA</ActionButton>
	{/if}

	<MfaEnrollModal isOpen={isEnrollingMfa} on:finished={closeModals} />
	<MfaUnenrollModal isOpen={isUnenrollingMfa} on:finished={closeModals} />
</form>
