<script lang="ts">
	import PostView from '#lib/components/PostView.svelte';
	import { publicUrl } from '#lib/media.ts';

	let { data } = $props();

	const post = $derived(data.post);
	const ogImage = $derived(publicUrl(post.cover_thumb_path ?? (post.cover_kind === 'image' ? post.cover_path : null)));
	const description = $derived(post.description.slice(0, 180) || data.profile.headline);
</script>

<svelte:head>
	<title>{post.title} — {data.profile.name}</title>
	<meta name="description" content={description} />
	<meta property="og:type" content="article" />
	<meta property="og:title" content={post.title} />
	<meta property="og:description" content={description} />
	{#if ogImage}
		<meta property="og:image" content={ogImage} />
		<meta name="twitter:card" content="summary_large_image" />
	{/if}
</svelte:head>

<div class="container">
	{#key post.id}
		<PostView {post} related={data.related} profile={data.profile} supabase={data.supabase} />
	{/key}
</div>
