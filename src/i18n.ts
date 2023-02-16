import type { Readable } from "svelte/store";
import { _, addMessages, getLocaleFromNavigator, init, locale as _locale } from "svelte-i18n";
import { derived, get } from "svelte/store";
import { isRecord } from "./transport/schemas";
import { isString } from "./helpers/isString";
import { logger } from "./logger";

// ** Language files **
import enUS from "./locales/en-US.json";
import ptBR from "./locales/pt-BR.json";

const messages = {
	"en-US": enUS,
	"pt-BR": ptBR,
} as const;

export type LocaleCode = keyof typeof messages;

/** Returns `true` if the given string is a supported locale code. */
export function isSupportedLocaleCode(tbd: unknown): tbd is LocaleCode {
	return Object.keys(messages).includes(tbd as string);
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
	 * A string describing the locale, especially for visually-impaired readers.
	 *
	 * @example "United States English"
	 */
	readonly name: string;

	/**
	 * A brief string describing the locale.
	 *
	 * @example "English (USA)"
	 */
	readonly shortName: string;
}

function isLocaleDescriptor(tbd: unknown): tbd is LocaleDescriptor {
	return (
		isRecord(tbd) &&
		"code" in tbd &&
		"flag" in tbd &&
		"name" in tbd &&
		"shortName" in tbd &&
		isSupportedLocaleCode(tbd["code"]) &&
		isString(tbd["flag"]) &&
		isString(tbd["name"]) &&
		isString(tbd["shortName"])
	);
}

function assertLocaleDescriptor(tbd: unknown): asserts tbd is LocaleDescriptor {
	// TODO: Use superstruct instead
	if (!isLocaleDescriptor(tbd))
		throw new TypeError(`Value is not a LocaleDescriptor: ${JSON.stringify(tbd)}`);
}

type StoreValue<T> = T extends Readable<infer S> ? S : never;

/**
 * Internationalizes the given `keypath` based on the current locale.
 * Use this function in imperative environments outside of Svelte components.
 *
 * @important Avoid using this function in declarative contexts. Instead,
 * subscribe to the `_` store.
 */
export function t(...[keypath, options]: Parameters<StoreValue<typeof _>>): string {
	return get(_)(keypath, options);
}

// Use this store instead of the `t` function in Svelte components.
export { _ } from "svelte-i18n";

// Ensure metadata is valid
for (const locale of Object.values(messages)) {
	assertLocaleDescriptor(locale.meta);
}

/** Metadata about the current locale. */
export const locale = derived<typeof _locale, LocaleDescriptor>(_locale, $locale => {
	if (isSupportedLocaleCode($locale)) {
		const meta = messages[$locale].meta;
		if (isLocaleDescriptor(meta)) return meta;
	}
	return messages["en-US"].meta as LocaleDescriptor; // ASSUMPTION: we've already asserted this case
});

/** Set the current locale. */
export async function setLocale(code: LocaleCode): Promise<void> {
	await _locale.set(code);
	logger.debug(`User manually selected locale ${code}`);
}

/** The list of supported locales. */
export const locales: ReadonlyArray<LocaleDescriptor> = Object.entries(messages) //
	.map(([code, strings]) => ({
		code: code as LocaleCode,
		name: strings.meta.name,
		shortName: strings.meta.shortName,
		flag: strings.meta.flag,
	}));

// **
// ** Set up Svelte I18N Runtime **
// **

const fallbackLocale: LocaleCode = "en-US";

const initialLocale = getLocaleFromNavigator();
logger.debug(`Navigator locale: ${initialLocale ?? "null"}`);

Object.entries(messages).forEach(([locale, partials]) => {
	addMessages(locale, partials);
});

// Initialize Svelte I18N
logger.debug("Loading I18N module...");
void init({
	fallbackLocale,
	initialLocale,
});
logger.debug("I18N module loaded");
