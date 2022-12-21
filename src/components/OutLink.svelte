<script lang="ts">
	export let to: string | URL;
	export let title: string | undefined = undefined;

	$: href = typeof to === "string" ? to : to.href;
</script>

<a {href} target="_blank" rel="noopener noreferrer" {title}>
	<slot />
</a>
