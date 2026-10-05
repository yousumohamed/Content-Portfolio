<script lang="ts">
	import { page } from '$app/state';
</script>

<svelte:head>
	<title>{page.status} — Not found</title>
</svelte:head>

<div class="wrap">
	<p class="code">{page.status}</p>
	<h1>{page.status === 404 ? "This page doesn't exist" : 'Something went wrong'}</h1>
	<p class="msg">{page.error?.message}</p>
	<a class="btn btn-primary" href="/">Back to the work</a>
</div>

<style>
	.wrap {
		min-height: 80vh;
		display: grid;
		place-content: center;
		justify-items: center;
		text-align: center;
		gap: 12px;
		padding: 24px;
	}
	.code {
		font-size: clamp(4rem, 14vw, 9rem);
		font-weight: 600;
		letter-spacing: -0.06em;
		line-height: 0.9;
		color: var(--line-strong);
	}
	h1 {
		font-size: 1.5rem;
	}
	.msg {
		color: var(--muted);
		margin-bottom: 12px;
	}
</style>
