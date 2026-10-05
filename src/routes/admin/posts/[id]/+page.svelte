<script lang="ts">
	import PostEditor from '#lib/components/admin/PostEditor.svelte';

	let { data } = $props();
</script>

<svelte:head><title>{data.post.title} — Studio</title></svelte:head>

{#key data.post.id}
	<PostEditor supabase={data.supabase} categories={data.categories} post={data.post} />
{/key}
