<script lang="ts" generics="T">
	import type { Snippet } from 'svelte';

	interface Props {
		items: T[];
		/** height / width of the media for an item */
		ratio: (item: T) => number;
		key: (item: T) => string;
		children: Snippet<[T, number]>;
		/** extra height per card (caption), as a fraction of column width */
		caption?: number;
		/** column count cap, e.g. for narrow containers */
		maxCols?: number;
	}

	let { items, ratio, key, children, caption = 0.17, maxCols = 5 }: Props = $props();

	let width = $state(0);

	const cols = $derived(
		Math.min(maxCols, width === 0 ? 4 : width < 560 ? 2 : width < 920 ? 3 : width < 1320 ? 4 : 5)
	);

	/** Shortest-column-first placement keeps reading order roughly left→right, top→bottom. */
	const columns = $derived.by(() => {
		const out = Array.from({ length: cols }, () => ({ h: 0, items: [] as { item: T; index: number }[] }));
		items.forEach((item, index) => {
			let target = out[0];
			for (const c of out) if (c.h < target.h - 0.001) target = c;
			target.items.push({ item, index });
			target.h += ratio(item) + caption;
		});
		return out;
	});
</script>

<div class="masonry" class:ready={width > 0} bind:clientWidth={width} style:--cols={cols}>
	{#each columns as column, c (c)}
		<div class="col">
			{#each column.items as entry (key(entry.item))}
				{@render children(entry.item, entry.index)}
			{/each}
		</div>
	{/each}
</div>

<style>
	.masonry {
		--gap: 20px;
		display: grid;
		grid-template-columns: repeat(var(--cols), minmax(0, 1fr));
		gap: var(--gap);
		align-items: start;
		opacity: 0;
		transition: opacity 0.35s var(--ease);
	}
	.masonry.ready {
		opacity: 1;
	}
	.col {
		display: grid;
		gap: var(--gap);
		min-width: 0;
	}
	@media (max-width: 760px) {
		.masonry {
			--gap: 12px;
		}
	}
	@media (scripting: none) {
		.masonry {
			opacity: 1;
		}
	}
</style>
