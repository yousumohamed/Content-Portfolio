<script lang="ts">
	import { goto, invalidate } from '$app/navigation';
	import { page } from '$app/state';
	import { ArrowLeft, LoaderCircle } from '@lucide/svelte';

	let { data } = $props();

	let email = $state('');
	let password = $state('');
	let error = $state('');
	let busy = $state(false);

	async function submit(e: SubmitEvent) {
		e.preventDefault();
		busy = true;
		error = '';
		const { error: err } = await data.supabase.auth.signInWithPassword({ email: email.trim(), password });
		if (err) {
			error = err.message === 'Invalid login credentials' ? 'Email or password is incorrect.' : err.message;
			busy = false;
			return;
		}
		await invalidate('supabase:auth');
		const next = page.url.searchParams.get('next');
		goto(next?.startsWith('/admin') ? next : '/admin', { replace: true });
	}
</script>

<svelte:head>
	<title>Sign in — Studio</title>
	<meta name="robots" content="noindex" />
</svelte:head>

<div class="page">
	<a class="back" href="/"><ArrowLeft size={16} />Back to site</a>

	<form class="card-surface" onsubmit={submit}>
		<div class="mark" aria-hidden="true"><span></span><span></span><span></span><span></span></div>
		<h1>Studio</h1>
		<p class="sub">Sign in to manage your work.</p>

		<label class="field">
			<span class="label">Email</span>
			<input class="input" type="email" autocomplete="email" required bind:value={email} />
		</label>
		<label class="field">
			<span class="label">Password</span>
			<input class="input" type="password" autocomplete="current-password" required bind:value={password} />
		</label>

		{#if error}<p class="error" role="alert">{error}</p>{/if}

		<button class="btn btn-primary submit" disabled={busy}>
			{#if busy}<LoaderCircle size={16} class="spin" />{/if}
			Sign in
		</button>
	</form>
</div>

<style>
	.page {
		min-height: 100vh;
		display: grid;
		place-items: center;
		padding: 24px 16px;
	}
	.back {
		position: fixed;
		top: 20px;
		left: 20px;
		display: inline-flex;
		align-items: center;
		gap: 6px;
		font-size: 0.875rem;
		color: var(--muted);
	}
	.back:hover {
		color: var(--ink);
	}
	form {
		width: min(400px, 100%);
		display: grid;
		gap: 16px;
		padding: 36px 32px 32px;
		box-shadow: var(--shadow);
	}
	.mark {
		display: grid;
		grid-template-columns: repeat(2, 10px);
		gap: 3px;
		margin-bottom: 4px;
	}
	.mark span {
		height: 12px;
		border-radius: 3px;
		background: var(--ink);
	}
	.mark span:nth-child(2) {
		height: 8px;
	}
	.mark span:nth-child(3) {
		height: 8px;
		margin-top: -4px;
	}
	h1 {
		font-size: 1.6rem;
	}
	.sub {
		margin-top: -10px;
		margin-bottom: 8px;
		color: var(--muted);
		font-size: 0.92rem;
	}
	.error {
		font-size: 0.85rem;
		color: var(--danger);
	}
	.submit {
		height: 44px;
		margin-top: 4px;
	}
</style>
