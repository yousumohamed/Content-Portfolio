import type { ProfileLinks } from './types';

const LABELS: Record<keyof ProfileLinks, string> = {
	instagram: 'Instagram',
	youtube: 'YouTube',
	tiktok: 'TikTok',
	x: 'X',
	behance: 'Behance',
	website: 'Website'
};

export const SOCIAL_KEYS = Object.keys(LABELS) as (keyof ProfileLinks)[];
export const socialLabel = (k: keyof ProfileLinks) => LABELS[k];

export function socialLinks(links: ProfileLinks | null | undefined) {
	return SOCIAL_KEYS.filter((k) => links?.[k]?.trim()).map((k) => {
		const raw = links![k]!.trim();
		return { key: k, label: LABELS[k], href: /^https?:\/\//.test(raw) ? raw : `https://${raw}` };
	});
}
