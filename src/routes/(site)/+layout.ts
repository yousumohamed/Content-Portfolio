import type { Category, Profile } from '#lib/types.ts';
import type { LayoutLoad } from './$types';

const FALLBACK_PROFILE: Profile = {
	name: 'Portfolio',
	headline: 'Visual work — photography, film & motion.',
	bio: '',
	location: '',
	email: '',
	avatar_path: null,
	links: {}
};

export const load: LayoutLoad = async ({ parent }) => {
	const { supabase } = await parent();

	const [profileRes, categoriesRes, countRes] = await Promise.all([
		supabase.from('gallery_profile').select('*').eq('id', 1).maybeSingle(),
		supabase.from('gallery_categories').select('id, name, slug, position').order('position').order('name'),
		supabase
			.from('gallery_posts')
			.select('id', { count: 'exact', head: true })
			.eq('status', 'published')
			.gt('media_count', 0)
	]);

	const setupError = profileRes.error?.message ?? categoriesRes.error?.message ?? null;
	if (setupError) console.error('[setup]', setupError);

	return {
		profile: { ...FALLBACK_PROFILE, ...(profileRes.data ?? {}) } as Profile,
		categories: (categoriesRes.data ?? []) as Category[],
		totalPosts: countRes.count ?? 0,
		setupError
	};
};
