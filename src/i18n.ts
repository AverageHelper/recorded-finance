import type { FormatXMLElementFn } from "intl-messageformat";
import { _, addMessages, getLocaleFromNavigator, init, locale as _locale } from "svelte-i18n";
import { derived, get } from "svelte/store";

// ** Language files **
import enUS from "./locales/en-US.json";
import ptBR from "./locales/pt-BR.json";

const messages = {
	"en-US": enUS,
	"pt-BR": ptBR,
} as const;

export type LocaleCode = keyof typeof messages;

/** Returns `true` if the given string is a supported locale code. */
export function isSupportedLocaleCode(tbd: string | null | undefined): tbd is LocaleCode {
	if (tbd === null || tbd === undefined) return false;
	return Object.keys(messages).includes(tbd);
}

export interface LocaleDescriptor {
	/**
	 * The locale code.
	 *
	 * @example "en-US"
	 */
	readonly code: LocaleCode;

	/**
	 * An emoji flag representing the locale.
	 *
	 * @example "🇺🇸"
	 */
	readonly flag: string;

	/**
	 * A string describing the locale to visually-impaired readers.
	 *
	 * @example "United States English"
	 */
	readonly language: string;
}

// Copied from `svelte-i18n`
type InterpolationValues =
	| Record<
			string,
			string | number | boolean | Date | FormatXMLElementFn<unknown> | null | undefined
	  >
	| undefined;

// Copied from `svelte-i18n`
interface MessageObject {
	id: string;
	locale?: string;
	format?: string;
	default?: string;
	values?: InterpolationValues;
}

/**
 * Internationalizes the given `keypath` based on the current locale.
 * Use this function in imperative environments outside of Svelte components.
 *
 * @important Avoid using this function in declarative contexts. Instead,
 * subscribe to the `_` store.
 */
export function t(keypath: string | MessageObject, options?: Omit<MessageObject, "id">): string {
	return get(_)(keypath, options);
}

// Use this store instead of the `t` function in Svelte components.
export { _ } from "svelte-i18n";

// Formatter consumers should import from here, not svelte-i18n directly,
// so that the formatter gets properly initialized in unit tests.
export { getNumberFormatter } from "svelte-i18n";

/** Metadata about the current locale. */
export const locale = derived(_locale, $locale => {
	if (isSupportedLocaleCode($locale)) {
		return messages[$locale].meta;
	}
	return messages["en-US"].meta;
});

/** Set the current locale. */
export async function setLocale(code: LocaleCode): Promise<void> {
	await _locale.set(code);
	console.debug(`User manually selected locale ${code}`);
}

/** The list of supported locales. */
export const locales: ReadonlyArray<LocaleDescriptor> = Object.entries(messages) //
	.map(([code, strings]) => ({
		code: code as LocaleCode,
		language: strings.meta.language,
		flag: strings.meta.flag,
	}));

// **
// ** Set up Svelte I18N Runtime **
// **

const fallbackLocale: LocaleCode = "en-US";

const initialLocale = getLocaleFromNavigator();
console.debug(`Navigator locale: ${initialLocale ?? "null"}`);

Object.entries(messages).forEach(([locale, partials]) => {
	addMessages(locale, partials);
});

// Initialize Svelte I18N
console.debug("Loading I18N module...");
void init({
	fallbackLocale,
	initialLocale,
});
console.debug("I18N module loaded");
