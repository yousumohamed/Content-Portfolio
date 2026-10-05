<script lang="ts">
	import { ChevronLeft, ChevronRight, X } from '@lucide/svelte';
	import { fade } from 'svelte/transition';
	import type { Media } from '../types';
	import { publicUrl } from '../media';

	interface Props {
		items: Media[];
		index: number;
		onclose: () => void;
	}

	let { items, index = $bindable(), onclose }: Props = $props();

	const current = $derived(items[index]);
	const go = (d: number) => (index = (index + d + items.length) % items.length);

	function onkeydown(e: KeyboardEvent) {
		if (e.key === 'Escape') {
			e.stopPropagation();
			onclose();
		} else if (e.key === 'ArrowRight') go(1);
		else if (e.key === 'ArrowLeft') go(-1);
	}

	$effect(() => {
		const prev = document.documentElement.style.overflow;
		document.documentElement.style.overflow = 'hidden';
		return () => (document.documentElement.style.overflow = prev);
	});
</script>

<svelte:window {onkeydown} />

<div class="lightbox" role="dialog" aria-modal="true" aria-label="Image viewer" transition:fade={{ duration: 160 }}>
	<button class="backdrop" aria-label="Close" onclick={onclose}></button>

	{#key current.id}
		<img src={publicUrl(current.path)} alt={current.alt} in:fade={{ duration: 180 }} />
	{/key}

	<div class="bar">
		<span class="count">{index + 1} / {items.length}</span>
		<button class="ctl" onclick={onclose} aria-label="Close viewer"><X size={20} /></button>
	</div>

	{#if items.length > 1}
		<button class="ctl nav prev" onclick={() => go(-1)} aria-label="Previous image"><ChevronLeft size={22} /></button>
		<button class="ctl nav next" onclick={() => go(1)} aria-label="Next image"><ChevronRight size={22} /></button>
	{/if}
</div>

<style>
	.lightbox {
		position: fixed;
		inset: 0;
		z-index: 90;
		display: grid;
		place-items: center;
		padding: 56px 16px 24px;
	}
	.backdrop {
		position: absolute;
		inset: 0;
		background: rgb(8 8 9 / 0.94);
		cursor: zoom-out;
	}
	img {
		position: relative;
		max-width: min(100%, 1800px);
		max-height: 100%;
		object-fit: contain;
		border-radius: 6px;
		pointer-events: none;
	}
	.bar {
		position: absolute;
		inset: 12px 12px auto 20px;
		display: flex;
		align-items: center;
		justify-content: space-between;
		color: rgb(255 255 255 / 0.7);
		font-size: 0.85rem;
		font-variant-numeric: tabular-nums;
	}
	.ctl {
		position: relative;
		display: grid;
		place-items: center;
		width: 44px;
		height: 44px;
		border-radius: 50%;
		color: #fff;
		background: rgb(255 255 255 / 0.08);
		transition: background 0.15s;
	}
	.ctl:hover {
		background: rgb(255 255 255 / 0.18);
	}
	.nav {
		position: absolute;
		top: 50%;
		translate: 0 -50%;
	}
	.prev {
		left: 16px;
	}
	.next {
		right: 16px;
	}
</style>
