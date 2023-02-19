<script lang="ts">
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
	import { _ } from "../i18n";
	import { APP_ROOTS } from "../model/ui/tabs";
	import { Collapse, NavbarToggler, Nav, NavItem } from "sveltestrap";
	import { isLoginEnabled, pKey, uid } from "../store";
	import { Link } from "svelte-navigator";
	import { link, useLocation, useNavigate } from "svelte-navigator";
	import ActionButton from "./buttons/ActionButton.svelte";
	import BackIcon from "../icons/Back.svelte";
	import ConditionallyExpandingNavbar from "./ConditionallyExpandingNavbar.svelte";
	import DiskUsage from "./DiskUsage.svelte";
	import Gear from "../icons/Gear.svelte";
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
	$: expand = isLoggedIn ? false : "md";

	let isOpen = false;

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
		isOpen = event.detail;
	}

	function close() {
		isOpen = false;
	}

	function toggle() {
		isOpen = !isOpen;
	}

	$: $location.pathname, close(); // Close when nav changes
	$: isLoggedIn, close(); // Close when we log in
</script>

<ConditionallyExpandingNavbar expand={!isLoggedIn}>
	<aside class="actions-container" role="heading" aria-level={1}>
		{#if !isRoute}
			<ActionButton kind="plain" on:click={goBack}>
				<BackIcon />
				<span class="visually-hidden">{$_("common.go-back")}</span>
			</ActionButton>
		{/if}
		{#if !isLoggedIn}
			<a href={homeRoute} class="navbar-brand" title={$_("common.platform")} use:link
				>{$_("common.platform")}</a
			>
		{/if}
	</aside>

	<!-- Tab bar if unlocked and we have room. Title only if unlocked. BootstrapMenu otherwise. Portal the tab bar to a bubble in the corner. -->
	{#if isUnlocked}
		<TabBar />
	{:else if isLoggedIn}
		<Lock />
	{/if}

	<NavbarToggler
		aria-controls="navbarNav"
		aria-expanded={isOpen}
		aria-label={$_("app.toggle-nav")}
		on:click={toggle}
	>
		<MenuIcon />
	</NavbarToggler>
	<Collapse {isOpen} {expand} navbar on:update={handleUpdate}>
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
			{:else}
				{#if isUnlocked}
					<NavItem>
						<DiskUsage />
					</NavItem>
				{/if}

				{#if isUnlocked}
					<NavItem>
						<Link class="nav-link" to={settingsPath()} on:click={close}>
							<span>{$_("app.nav.settings")}</span>
							<Gear />
						</Link>
					</NavItem>

					<NavItem>
						<Link class="nav-link" to={lockPath()} on:click={close}>
							<span>{$_("app.nav.lock")}</span>
							<Lock />
						</Link>
					</NavItem>
				{/if}

				<NavItem>
					<Link class="nav-link" to={logoutPath()} on:click={close}>
						<span>{$_("app.nav.log-out")}</span>
						<LogOut />
					</Link>
				</NavItem>
			{/if}
		</Nav>
	</Collapse>
</ConditionallyExpandingNavbar>
