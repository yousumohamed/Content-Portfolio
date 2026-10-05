<script lang="ts">
	import PostEditor from '#lib/components/admin/PostEditor.svelte';

	let { data } = $props();
</script>

<svelte:head><title>New post — Studio</title></svelte:head>

<PostEditor supabase={data.supabase} categories={data.categories} />
