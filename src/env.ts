import { defineEnvVars } from '@sveltejs/kit/env';

export const variables = defineEnvVars({
	PUBLIC_SUPABASE_URL: {
		public: true,
		static: true,
		description: 'Supabase project URL'
	},
	PUBLIC_SUPABASE_ANON_KEY: {
		public: true,
		static: true,
		description: 'Supabase anon (public) key — data is protected by RLS'
	},
	PUBLIC_MAX_UPLOAD_MB: {
		public: true,
		static: true,
		description:
			'Per-file upload limit of your Supabase project (Storage → Settings). Free plan: 50. Larger videos are compressed in the browser to fit.',
		schema: (value) => {
			const n = Number(value ?? 50);
			if (!Number.isFinite(n) || n <= 0) throw new Error('PUBLIC_MAX_UPLOAD_MB must be a positive number');
			return n;
		}
	}
});
