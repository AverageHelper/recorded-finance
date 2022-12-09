<script lang="ts">
	import type { LocaleCode } from "../i18n";
	import {
		Collapse,
		Navbar,
		NavbarToggler,
		// NavbarBrand,
		Nav,
		NavItem,
		Dropdown,
		DropdownToggle,
		DropdownMenu,
		DropdownItem,
	} from "sveltestrap";
	import { _, locale as currentLocale, locales, setLocale } from "../i18n";
	import { APP_ROOTS } from "../router";
	import { Link } from "svelte-navigator";
	import { lockPath, logoutPath, settingsPath } from "../router";
	import { pKey, uid } from "../store";
	import { tick } from "svelte";
	import { useLocation, useNavigate } from "svelte-navigator";
	import ActionButton from "./buttons/ActionButton.svelte";
	import BackIcon from "../icons/Back.svelte";
	import BootstrapMenu from "./BootstrapMenu.svelte";
	import DiskUsage from "./DiskUsage.svelte";
	import Gear from "../icons/Gear.svelte";
	import Lock from "../icons/Lock.svelte";
	import LogOut from "../icons/LogOut.svelte";
	import MenuIcon from "../icons/Menu.svelte";
	import TabBar from "./TabBar.svelte";

	const location = useLocation();
	const navigate = useNavigate();

	$: isRoute = APP_ROOTS.includes($location.pathname);
	$: isLoggedIn = $uid !== null;
	$: isUnlocked = $pKey !== null;

	let isMenuOpen = false;
	let isSelectingLanguage = false;
	$: $currentLocale && (isSelectingLanguage = false); // stop selecting when locale changes

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
</script>

<Navbar>
	<!-- <NavbarBrand href="/">Accountable</NavbarBrand> -->

	{#if isLoggedIn}
		<aside class="actions-container">
			{#if !isRoute}
				<ActionButton kind="plain" on:click={goBack}>
					<BackIcon />
					<span class="visually-hidden">{$_("common.go-back")}</span>
				</ActionButton>
			{/if}
		</aside>
	{/if}

	<!-- Tab bar if unlocked and we have room. Title only if unlocked. BootstrapMenu otherwise. Portal the tab bar to a bubble in the corner. -->
	{#if isUnlocked && isMenuOpen}
		<TabBar class="tab-bar" />
	{/if}

	{#if isLoggedIn}
		<NavbarToggler on:click={toggle}>
			<MenuIcon />
		</NavbarToggler>
		<Collapse isOpen={isMenuOpen} navbar on:update={handleUpdate}>
			<Nav class="ms-auto" navbar>
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
			</Nav>
		</Collapse>
	{:else if !isLoggedIn}
		<BootstrapMenu />
	{:else}
		<Lock />
	{/if}
</Navbar>

<style lang="scss" global>
	@use "styles/colors" as *;

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

			@media (hover: hover) {
				&:hover {
					text-decoration: none;
					font-weight: bold;
				}
			}

			.icon {
				color: color($label);
				margin-right: 8pt;
			}
		}
	}
</style>
