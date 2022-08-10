<script lang="ts">
	import { locale as current, isSupportedLocaleCode, locales, setLocale } from "../i18n";

	async function onSelectChange(event: Event & { currentTarget: EventTarget & HTMLSelectElement }) {
		const newValue = event.currentTarget.value;
		if (isSupportedLocaleCode(newValue)) {
			await setLocale(newValue);
		} else {
			await setLocale("en-US");
		}
	}
</script>

<label class={$$props["class"]}>
	<select value={$current.code} on:change={onSelectChange}>
		{#each locales as locale (locale.code)}
			<option value={locale.code}>
				<span class="flag">{locale.flag}</span>
				<span class="language">{locale.language}</span>
			</option>
		{/each}
	</select>
</label>

<style lang="scss">
	@use "styles/colors" as *;

	label {
		height: 100%;
		display: flex;
		flex-flow: row nowrap;
		align-items: center;
		margin: auto 2pt;
		padding: 0 4pt;
		border-radius: 4pt;
		border: 1pt solid color($clear);
		cursor: pointer;

		@media (hover: hover) {
			&:hover {
				border-color: color($separator);
			}
		}
	}

	select {
		all: unset;
		height: 100%;
		color: color($secondary-label);
	}
</style>
