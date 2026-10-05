<script lang="ts">
	import { Moon, Sun } from '@lucide/svelte';
	import { syncTheme, theme, toggleTheme } from '../theme.svelte';

	let { class: className = '' }: { class?: string } = $props();

	$effect(syncTheme);

	const label = $derived(theme.value === 'dark' ? 'Switch to light mode' : 'Switch to dark mode');
</script>

<button class="btn btn-ghost btn-icon btn-sm {className}" onclick={toggleTheme} aria-label={label} title={label}>
	{#if theme.value === 'dark'}<Sun size={17} />{:else}<Moon size={17} />{/if}
</button>
