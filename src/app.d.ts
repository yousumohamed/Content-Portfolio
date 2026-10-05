import type { Session, SupabaseClient, User } from '@supabase/supabase-js';
import type { FeedPost, Post } from '#lib/types.ts';

declare global {
	namespace App {
		interface Locals {
			supabase: SupabaseClient;
			safeGetSession: () => Promise<{ session: Session | null; user: User | null }>;
		}
		interface PageData {
			session: Session | null;
		}
		interface PageState {
			/** Post opened in an overlay via shallow routing. */
			post?: Post;
			related?: FeedPost[];
		}
	}
}

export {};
