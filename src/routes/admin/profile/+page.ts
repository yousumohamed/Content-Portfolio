import type { Profile } from '#lib/types.ts';
import type { PageLoad } from './$types';

export const load: PageLoad = async ({ parent }) => {
	const { supabase } = await parent();
	const { data, error } = await supabase.from('gallery_profile').select('*').eq('id', 1).maybeSingle();
	return { profile: data as Profile | null, error: error?.message ?? null };
};
