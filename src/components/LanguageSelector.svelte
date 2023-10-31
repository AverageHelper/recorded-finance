<script lang="ts">
	import { _, locale as current, isSupportedLocaleCode, locales, setLocale } from "../i18n";
	import { Tooltip } from "sveltestrap";

	let root: HTMLLabelElement | undefined;

	async function onSelectChange(event: Event & { currentTarget: EventTarget & HTMLSelectElement }) {
		const newValue = event.currentTarget.value;
		if (isSupportedLocaleCode(newValue)) {
			await setLocale(newValue);
		} else {
			await setLocale("en-US");
		}
	}
</script>

<label
	bind:this={root}
	aria-label={$_("common.current-language", { values: { name: $current.name } })}
>
	<Tooltip target={root}
		>{$_("common.change-language", { values: { name: $current.shortName } })}</Tooltip
	>
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
		cursor: pointer;
		padding: 3pt 6pt 2pt 8pt;
		margin: 4pt;
		font-size: 16pt;
		font-family: Helvetica;
		max-width: 1.13em; // approximate width of a flag emoji
		max-height: 1.26em; // approximate height of a flag emoji
		transition: opacity 0.3s;
		transition-property: opacity, transform;

		@media (hover: hover) {
			&:hover {
				background-color: color($separator);
			}
		}

		&:focus-visible {
			outline: solid 2pt color($link);
		}
	}
</style>
