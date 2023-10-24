import type { ComponentType } from "svelte/internal";
import { UnreachableCaseError } from "../../transport/errors";
import AccountIcon from "../../icons/IdCard.svelte";
import FileIcon from "../../icons/File.svelte";
import LocationIcon from "../../icons/Location.svelte";
import TagIcon from "../../icons/Tag.svelte";
import {
	aboutPath,
	accountsPath,
	attachmentsPath,
	homePath,
	installPath,
	locationsPath,
	lockPath,
	loginPath,
	securityPath,
	signupPath,
	tagsPath,
} from "../../router/routes";

export const appTabs = ["accounts", "attachments", "locations", "tags"] as const;

export type Tab = (typeof appTabs)[number];

export const APP_ROOTS: ReadonlyArray<string> = appTabs
	.map(tab => `/${tab}`)
	.concat([
		homePath(),
		aboutPath(),
		securityPath(),
		installPath(),
		loginPath(),
		lockPath(),
		signupPath(),
	]);

export function isAppTab(tbd: string | null | undefined): tbd is Tab {
	if (!(tbd ?? "")) return false; // nullish values don't count as `Tab` values lol
	return appTabs.includes(tbd as Tab);
}

export function labelIdForTab(tab: Tab): `app.nav.${typeof tab}` | "app.nav.generic-page" {
	if (isAppTab(tab)) return `app.nav.${tab}`;
	return "app.nav.generic-page";
}

export function routeForTab(tab: Tab): `/${typeof tab}` | "#" {
	switch (tab) {
		case "accounts":
			return accountsPath();
		case "attachments":
			return attachmentsPath();
		case "locations":
			return locationsPath();
		case "tags":
			return tagsPath();
		default:
			return "#";
	}
}

export function iconForTab(tab: Tab): ComponentType {
	switch (tab) {
		case "accounts":
			return AccountIcon;
		case "attachments":
			return FileIcon;
		case "locations":
			return LocationIcon;
		case "tags":
			return TagIcon;
		default:
			throw new UnreachableCaseError(tab);
	}
}
