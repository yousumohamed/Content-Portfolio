import { redirect } from '@sveltejs/kit';
import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = async ({ locals, url }) => {
	const { user } = await locals.safeGetSession();
	if (!user) redirect(303, `/login?next=${encodeURIComponent(url.pathname)}`);

	const { data, error } = await locals.supabase
		.from('gallery_admins')
		.select('user_id')
		.eq('user_id', user.id)
		.maybeSingle();

	return {
		email: user.email ?? '',
		isAdmin: Boolean(data),
		adminError: error?.message ?? null
	};
};
