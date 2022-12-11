<script lang="ts">
	import type { LocaleCode } from "../i18n";
	import {
		Collapse,
		Dropdown,
		DropdownToggle,
		DropdownMenu,
		DropdownItem,
		Navbar,
		NavbarToggler,
		Nav,
		NavItem,
	} from "sveltestrap";
	import {
		aboutPath,
		homePath,
		installPath,
		lockPath,
		loginPath,
		logoutPath,
		securityPath,
		settingsPath,
	} from "../router";
	import { _, locale as currentLocale, locales, setLocale } from "../i18n";
	import { APP_ROOTS } from "../router";
	import { isLoginEnabled, pKey, uid } from "../store";
	import { Link } from "svelte-navigator";
	import { link, useLocation, useNavigate } from "svelte-navigator";
	import { tick } from "svelte";
	import ActionButton from "./buttons/ActionButton.svelte";
	import BackIcon from "../icons/Back.svelte";
	import DiskUsage from "./DiskUsage.svelte";
	import Gear from "../icons/Gear.svelte";
	import LanguageSelector from "./LanguageSelector.svelte";
	import Lock from "../icons/Lock.svelte";
	import LogOut from "../icons/LogOut.svelte";
	import MenuIcon from "../icons/Menu.svelte";
	import TabBar from "./TabBar.svelte";

	interface Page {
		path: string;
		titleKey: `home.nav.${"home" | "about" | "security" | "install" | "log-in"}`;
	}

	const location = useLocation();
	const navigate = useNavigate();
	const homeRoute = homePath();

	$: currentPath = $location.pathname;
	$: isRoute = APP_ROOTS.includes(currentPath);
	$: isLoggedIn = $uid !== null;
	$: isUnlocked = $pKey !== null;

	let isMenuOpen = false;
	let isSelectingLanguage = false;

	function isNotNull<T>(tbd: T | null): tbd is T {
		return tbd !== null;
	}

	const pages: Array<Page> = [
		{ path: homePath(), titleKey: "home.nav.home" } as const,
		{ path: aboutPath(), titleKey: "home.nav.about" } as const,
		{ path: securityPath(), titleKey: "home.nav.security" } as const,
		{ path: installPath(), titleKey: "home.nav.install" } as const,
		isLoginEnabled ? ({ path: loginPath(), titleKey: "home.nav.log-in" } as const) : null,
	].filter(isNotNull);

	function goBack() {
		navigate(-1);
	}

	function handleUpdate(event: CustomEvent<boolean>) {
		isMenuOpen = event.detail;
	}

	async function onSelectLocale(code: LocaleCode) {
		await tick();
		await setLocale(code);
		isSelectingLanguage = false;
		isMenuOpen = false;
	}

	function close() {
		isMenuOpen = false;
		isSelectingLanguage = false;
	}

	// Close the menu when nav changes
	$: $location.pathname && close();

	function open() {
		isMenuOpen = true;
	}

	function toggle() {
		if (isMenuOpen) {
			close();
		} else {
			open();
		}
	}

	$: $currentLocale && (isSelectingLanguage = false); // stop selecting when locale changes
</script>

<Navbar expand={isLoggedIn ? false : "md"}>
	<aside class="actions-container">
		{#if !isRoute}
			<ActionButton kind="plain" on:click={goBack}>
				<BackIcon />
				<span class="visually-hidden">{$_("common.go-back")}</span>
			</ActionButton>
		{/if}
		{#if !isLoggedIn}
			<a
				href={homeRoute}
				class="navbar-brand"
				role="heading"
				aria-label={$_("common.platform")}
				title={$_("common.platform")}
				use:link>A&cent;countable</a
			>
		{/if}
	</aside>

	<!-- Tab bar if unlocked and we have room. Title only if unlocked. BootstrapMenu otherwise. Portal the tab bar to a bubble in the corner. -->
	{#if isUnlocked}
		{#if isMenuOpen}
			<TabBar class="tab-bar" />
		{/if}
	{:else if isLoggedIn}
		<Lock />
	{/if}

	<NavbarToggler
		aria-controls="navbarNav"
		aria-expanded={isMenuOpen}
		aria-label={$_("app.toggle-nav")}
		on:click={toggle}
	>
		<MenuIcon />
	</NavbarToggler>
	<Collapse isOpen={isMenuOpen} expand={isLoggedIn ? false : "md"} navbar on:update={handleUpdate}>
		<Nav id="navbarNav" class="ms-auto" navbar>
			{#if !isLoggedIn}
				{#each pages as page (page.path)}
					<NavItem active={currentPath === page.path}>
						<a
							class="nav-link {currentPath === page.path ? 'active' : 'inactive'}"
							href={page.path}
							on:click={close}
							use:link
							>{$_(page.titleKey)}
							{#if currentPath === page.path}
								<span class="visually-hidden">{$_("common.current-aside")}</span>
							{/if}
						</a>
					</NavItem>
				{/each}
				<NavItem>
					<div class="locale">
						<LanguageSelector />
					</div>
				</NavItem>
			{:else}
				{#if isUnlocked}
					<NavItem>
						<DiskUsage />
					</NavItem>
				{/if}

				<!-- Language Selector -->
				<Dropdown nav inNavbar>
					<DropdownToggle nav caret>
						<span class="icon">{$currentLocale.flag}</span>
						<span>{$currentLocale.shortName}</span>
					</DropdownToggle>
					<DropdownMenu end>
						{#each locales as locale (locale.code)}
							<DropdownItem on:click={() => onSelectLocale(locale.code)}>
								<span class="icon">{locale.flag}</span>
								<span>{locale.shortName}</span>
							</DropdownItem>
						{/each}
					</DropdownMenu>
				</Dropdown>

				{#if isUnlocked}
					<NavItem>
						<Link class="nav-link" to={settingsPath()} on:click={close}>
							<Gear />
							<span>{$_("app.nav.settings")}</span>
						</Link>
					</NavItem>

					<NavItem>
						<Link class="nav-link" to={lockPath()} on:click={close}>
							<Lock />
							<span>{$_("app.nav.lock")}</span>
						</Link>
					</NavItem>
				{/if}

				<NavItem>
					<Link class="nav-link" to={logoutPath()} on:click={close}>
						<LogOut />
						<span>{$_("app.nav.log-out")}</span>
					</Link>
				</NavItem>
			{/if}
		</Nav>
	</Collapse>
</Navbar>

<style lang="scss" global>
	@use "styles/colors" as *;

	.navbar-brand {
		display: block;
		font-weight: bold;
		font-size: x-large;
		z-index: 50;
		margin-left: 16pt;
		text-decoration: none;
		border-radius: 4pt;
		color: color($label);
		margin-right: auto;

		@media (hover: hover) {
			&:hover {
				color: color($label);
				text-decoration: none;
			}
		}

		&:active,
		&:focus {
			color: color($label);
		}

		&:focus-visible {
			outline: 2pt solid color($link);
		}
	}

	.tab-bar {
		margin: 0 auto;
	}

	.navbar {
		position: sticky;
		top: 0;
		z-index: 1000;
		background-color: color($navbar-background);
		color: color($label);

		.actions-container {
			$margin: 0.75em;
			display: flex;
			flex-flow: row nowrap;
			align-items: center;
			justify-content: space-evenly;
			height: calc(100% - #{$margin} * 2);
			min-width: 2.8em;
			margin: $margin 1em;
			color: inherit;
		}

		.tab-bar {
			height: 100%;
		}
	}

	.navbar-toggler {
		height: 36pt;
		width: 44pt;
		padding: 0 4pt;
		color: color($label);
		border-color: color($clear);
		margin-left: auto;
		z-index: 100;

		.icon {
			width: 100%;
			height: 100%;
		}
	}

	ul.navbar-nav {
		margin-left: 16pt;
		margin-right: 16pt;
	}

	li.nav-item {
		height: fit-content;
		margin-left: auto;

		> a.nav-link {
			display: flex;
			flex-flow: row nowrap;
			align-items: center;
			color: color($label);

			&.active {
				color: color($label);
				font-weight: bold;
			}

			&.inactive {
				color: color($label);
			}

			.icon {
				color: color($label);
				margin-right: 8pt;
			}
		}
	}

	nav.navbar {
		#navbarNav {
			z-index: 100;
			margin-left: auto;
		}

		ul,
		.navbar-toggler {
			margin-left: auto;
			margin-right: 8pt;
			z-index: 50;
		}

		li.nav-item {
			> .locale {
				width: fit-content;
				margin-left: auto;
			}

			a.nav-link {
				border-radius: 4pt;

				&:focus-visible {
					outline: 2pt solid color($link);
				}
			}
		}
	}
</style>
