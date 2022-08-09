<script lang="ts">
	import { _ } from "../../i18n";
	import { allTags } from "../../store";
	import List from "../../components/List.svelte";
	import Tag from "./Tag.svelte";

	$: numberOfTags = $allTags.length;
</script>

<main class="content">
	<div class="heading">
		<h1>{$_("tags.list.heading")}</h1>
		<p>{$_("tags.list.how-to-create")}</p>
	</div>

	<List>
		{#each $allTags as tag (tag.id)}
			<li>
				<Tag {tag} showsCount={true} />
				<!-- <ConfirmDestroyTag
					{tag}
					isOpen={tagIdToDestroy === tag.id}
					on:yes={confirmDeleteTag}
					on:no={cancelDeleteTag}
				/> -->
			</li>
		{/each}
		{#if numberOfTags > 0}
			<li>
				<p class="footer"
					>{#if numberOfTags === 1}{$_("tags.count.tag")}{:else}{$_("tags.count.tags", {
							values: { n: numberOfTags },
						})}{/if}</p
				>
			</li>
		{/if}
	</List>
</main>

<style lang="scss">
	@use "styles/colors" as *;

	.heading {
		max-width: 36em;
		margin: 1em auto;

		> h1 {
			margin: 0;
		}
	}

	.footer {
		color: color($secondary-label);
		user-select: none;
	}
</style>
