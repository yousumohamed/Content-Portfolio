<script lang="ts">
	import '@fontsource-variable/dm-sans/opsz.css';
	import '#lib/styles/global.css';
	import { invalidate } from '$app/navigation';
	import Toaster from '#lib/components/Toaster.svelte';

	let { data, children } = $props();

	$effect(() => {
		const { data: sub } = data.supabase.auth.onAuthStateChange((_event, next) => {
			if (next?.expires_at !== data.session?.expires_at) invalidate('supabase:auth');
		});
		return () => sub.subscription.unsubscribe();
	});
</script>

{@render children()}
<Toaster />
