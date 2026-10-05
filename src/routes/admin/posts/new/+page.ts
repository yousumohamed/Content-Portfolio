import type { Category } from '#lib/types.ts';
import type { PageLoad } from './$types';

export const load: PageLoad = async ({ parent }) => {
	const { supabase } = await parent();
	const { data } = await supabase.from('gallery_categories').select('*').order('position').order('name');
	return { categories: (data ?? []) as Category[] };
};
