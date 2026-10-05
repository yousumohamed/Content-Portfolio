<script lang="ts">
	import { fly } from 'svelte/transition';
	import { toasts } from '../toast.svelte';
</script>

<div class="toaster" role="status" aria-live="polite">
	{#each toasts as t (t.id)}
		<div class="toast {t.tone}" transition:fly={{ y: 12, duration: 220 }}>
			<span class="dot"></span>{t.message}
		</div>
	{/each}
</div>

<style>
	.toaster {
		position: fixed;
		left: 50%;
		bottom: 24px;
		transform: translateX(-50%);
		display: grid;
		gap: 8px;
		z-index: 100;
		pointer-events: none;
	}
	.toast {
		display: flex;
		align-items: center;
		gap: 10px;
		padding: 11px 16px 11px 14px;
		border-radius: 999px;
		background: var(--ink);
		color: var(--bg);
		font-size: 0.875rem;
		font-weight: 500;
		box-shadow: var(--shadow-lg);
		white-space: nowrap;
	}
	.dot {
		width: 7px;
		height: 7px;
		border-radius: 50%;
		background: var(--muted);
	}
	.success .dot {
		background: var(--success);
	}
	.error .dot {
		background: var(--danger);
	}
</style>
