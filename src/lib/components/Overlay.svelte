<script lang="ts">
	import type { Snippet } from 'svelte';
	import { ArrowUpRight, X } from '@lucide/svelte';
	import { fade, fly } from 'svelte/transition';

	interface Props {
		onclose: () => void;
		/** Full-page URL, offered as an "open" link. */
		href?: string;
		label?: string;
		children: Snippet;
	}

	let { onclose, href, label = 'Details', children }: Props = $props();
	let scroller = $state<HTMLDivElement>();

	$effect(() => {
		const root = document.documentElement;
		const prev = root.style.overflow;
		root.style.overflow = 'hidden';
		scroller?.focus();
		return () => (root.style.overflow = prev);
	});

	function onkeydown(e: KeyboardEvent) {
		if (e.key === 'Escape' && !e.defaultPrevented) onclose();
	}
</script>

<svelte:window {onkeydown} />

<div class="overlay" role="dialog" aria-modal="true" aria-label={label} transition:fade={{ duration: 180 }}>
	<div class="scroller" bind:this={scroller} tabindex="-1">
		<button class="backdrop" aria-label="Close" onclick={onclose}></button>
		<div class="panel" transition:fly={{ y: 24, duration: 260, opacity: 0 }}>
			<div class="tools">
				{#if href}
					<a class="btn btn-sm" href={href} data-sveltekit-reload>Open page <ArrowUpRight size={15} /></a>
				{/if}
				<button class="btn btn-icon btn-sm" onclick={onclose} aria-label="Close"><X size={17} /></button>
			</div>
			{@render children()}
		</div>
	</div>
</div>

<style>
	.overlay {
		position: fixed;
		inset: 0;
		z-index: 60;
		background: rgb(10 10 11 / 0.55);
	}
	.scroller {
		position: absolute;
		inset: 0;
		overflow-y: auto;
		overscroll-behavior: contain;
		outline: none;
	}
	.backdrop {
		position: fixed;
		inset: 0;
		cursor: default;
	}
	.panel {
		position: relative;
		width: min(1320px, calc(100% - 48px));
		margin: 32px auto 48px;
		padding: 28px clamp(20px, 4vw, 56px) 48px;
		border-radius: var(--radius-lg);
		background: var(--bg);
		box-shadow: var(--shadow-lg);
	}
	.tools {
		position: sticky;
		top: 12px;
		z-index: 5;
		display: flex;
		justify-content: flex-end;
		gap: 8px;
		height: 0;
	}
	.tools > :global(*) {
		box-shadow: var(--shadow-sm);
	}
	@media (max-width: 640px) {
		.panel {
			width: 100%;
			margin: 12px 0 0;
			min-height: calc(100% - 12px);
			border-radius: var(--radius-lg) var(--radius-lg) 0 0;
			padding-inline: var(--gutter);
		}
	}
</style>
