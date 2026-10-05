<script lang="ts">
	import { goto, invalidate } from '$app/navigation';
	import { page } from '$app/state';
	import { ArrowUpRight, LayoutGrid, LogOut, Plus, Tags, User } from '@lucide/svelte';

	let { data, children } = $props();

	const NAV = [
		{ href: '/admin', label: 'Posts', icon: LayoutGrid, exact: true },
		{ href: '/admin/posts/new', label: 'New post', icon: Plus, exact: true },
		{ href: '/admin/categories', label: 'Categories', icon: Tags, exact: false },
		{ href: '/admin/profile', label: 'Profile', icon: User, exact: false }
	];

	const isActive = (href: string, exact: boolean) =>
		exact ? page.url.pathname === href : page.url.pathname.startsWith(href);

	async function signOut() {
		await data.supabase.auth.signOut();
		await invalidate('supabase:auth');
		goto('/login', { replace: true });
	}
</script>

<svelte:head>
	<meta name="robots" content="noindex" />
</svelte:head>

<div class="shell">
	<aside class="side">
		<a href="/admin" class="brand">
			<span class="mark" aria-hidden="true"><span></span><span></span><span></span><span></span></span>
			Studio
		</a>

		<nav aria-label="Admin">
			{#each NAV as item (item.href)}
				<a href={item.href} class="nav-item" aria-current={isActive(item.href, item.exact) ? 'page' : undefined}>
					<item.icon size={17} strokeWidth={2} />
					<span>{item.label}</span>
				</a>
			{/each}
		</nav>

		<div class="side-foot">
			<a href="/" class="nav-item" target="_blank" rel="noopener">
				<ArrowUpRight size={17} /><span>View site</span>
			</a>
			<div class="account">
				<span class="email" title={data.email}>{data.email}</span>
				<button class="btn btn-ghost btn-icon btn-sm" onclick={signOut} aria-label="Sign out" title="Sign out">
					<LogOut size={16} />
				</button>
			</div>
		</div>
	</aside>

	<div class="main">
		{#if data.isAdmin}
			{@render children()}
		{:else}
			<div class="denied card-surface">
				<h1>No admin access</h1>
				<p>
					You're signed in as <strong>{data.email}</strong>, but this account isn't a gallery admin yet. Add it in
					Supabase SQL Editor:
				</p>
				<pre><code
						>insert into public.gallery_admins (user_id)
select id from auth.users where email = '{data.email}';</code
					></pre>
				{#if data.adminError}<p class="err">{data.adminError}</p>{/if}
				<button class="btn" onclick={signOut}><LogOut size={16} />Sign out</button>
			</div>
		{/if}
	</div>
</div>

<style>
	.shell {
		display: grid;
		grid-template-columns: 232px minmax(0, 1fr);
		min-height: 100vh;
	}
	.side {
		position: sticky;
		top: 0;
		height: 100vh;
		display: flex;
		flex-direction: column;
		gap: 24px;
		padding: 20px 14px;
		border-right: 1px solid var(--line);
		background: var(--surface);
	}
	.brand {
		display: flex;
		align-items: center;
		gap: 10px;
		padding: 4px 10px;
		font-weight: 600;
		font-size: 1.05rem;
		letter-spacing: -0.02em;
	}
	.mark {
		display: grid;
		grid-template-columns: repeat(2, 7px);
		gap: 2px;
	}
	.mark span {
		height: 9px;
		border-radius: 2px;
		background: var(--ink);
	}
	.mark span:nth-child(2),
	.mark span:nth-child(3) {
		height: 6px;
	}
	.mark span:nth-child(3) {
		margin-top: -3px;
	}
	nav {
		display: grid;
		gap: 2px;
	}
	.nav-item {
		display: flex;
		align-items: center;
		gap: 10px;
		height: 38px;
		padding: 0 10px;
		border-radius: var(--radius-sm);
		font-size: 0.9rem;
		font-weight: 500;
		color: var(--muted);
		transition:
			background 0.15s,
			color 0.15s;
	}
	.nav-item:hover {
		color: var(--ink);
		background: var(--surface-2);
	}
	.nav-item[aria-current='page'] {
		color: var(--ink);
		background: var(--surface-2);
	}
	.side-foot {
		margin-top: auto;
		display: grid;
		gap: 8px;
	}
	.account {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 8px;
		padding: 10px 4px 0 10px;
		border-top: 1px solid var(--line);
	}
	.email {
		font-size: 0.8rem;
		color: var(--muted);
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.main {
		min-width: 0;
		padding: 32px clamp(16px, 4vw, 48px) 80px;
	}
	.denied {
		max-width: 620px;
		display: grid;
		gap: 14px;
		padding: 28px;
	}
	.denied p {
		color: var(--ink-2);
	}
	pre {
		margin: 0;
		padding: 14px 16px;
		border-radius: var(--radius-sm);
		background: var(--surface-2);
		overflow-x: auto;
		font-size: 0.82rem;
	}
	.err {
		font-size: 0.8rem;
		color: var(--danger) !important;
	}
	.denied .btn {
		justify-self: start;
	}

	@media (max-width: 860px) {
		.shell {
			grid-template-columns: 1fr;
		}
		.side {
			position: sticky;
			z-index: 20;
			height: auto;
			flex-direction: row;
			align-items: center;
			gap: 8px;
			padding: 10px 12px;
			border-right: 0;
			border-bottom: 1px solid var(--line);
			overflow-x: auto;
		}
		.brand {
			display: none;
		}
		nav {
			display: flex;
		}
		.nav-item {
			white-space: nowrap;
		}
		.side-foot {
			margin: 0 0 0 auto;
			display: flex;
		}
		.side-foot > .nav-item span,
		.email {
			display: none;
		}
		.account {
			border: 0;
			padding: 0;
		}
		.main {
			padding-top: 24px;
		}
	}
</style>
