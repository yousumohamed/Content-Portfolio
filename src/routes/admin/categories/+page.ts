import type { Category } from '#lib/types.ts';
import type { PageLoad } from './$types';

export const load: PageLoad = async ({ parent, depends }) => {
	depends('admin:categories');
	const { supabase } = await parent();
	const { data, error } = await supabase
		.from('gallery_categories')
		.select('id, name, slug, position, posts:gallery_posts(count)')
		.order('position')
		.order('name');

	const categories = (data ?? []).map((c) => ({
		...(c as unknown as Category),
		count: (c.posts as unknown as { count: number }[])?.[0]?.count ?? 0
	}));
	return { categories, error: error?.message ?? null };
};
