<script lang="ts">
	import { _, locale as current, isSupportedLocaleCode, locales, setLocale } from "../i18n";

	async function onSelectChange(event: Event & { currentTarget: EventTarget & HTMLSelectElement }) {
		const newValue = event.currentTarget.value;
		if (isSupportedLocaleCode(newValue)) {
			await setLocale(newValue);
		} else {
			await setLocale("en-US");
		}
	}
</script>

<label aria-label={$_("common.current-language", { values: { name: $current.name } })}>
	<select value={$current.code} on:change={onSelectChange}>
		{#each locales as locale (locale.code)}
			<option value={locale.code}>{locale.flag} {locale.shortName}</option>
		{/each}
	</select>
</label>

<style lang="scss">
	@use "styles/colors" as *;

	select {
		all: unset; // remove browser's default styles in favor of a plainer look
		border-radius: 4pt;
		border: 1pt solid color($clear);
		cursor: pointer;
		padding: 0 4pt;
		font-size: x-large;
		max-width: 1.35em; // approximate width of a flag emoji
		transition: opacity 0.3s;
		transition-property: opacity, transform;

		@media (hover: hover) {
			&:hover {
				border-color: color($separator);
			}
		}

		&:focus-visible {
			outline: solid 2pt color($link);
		}
	}
</style>
