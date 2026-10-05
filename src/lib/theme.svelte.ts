export type Theme = 'light' | 'dark';

const KEY = 'theme';

/** Current theme. Light is the default; the inline script in app.html applies the saved choice before paint. */
export const theme = $state<{ value: Theme }>({ value: 'light' });

export function syncTheme() {
	theme.value = document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light';
}

export function toggleTheme() {
	theme.value = theme.value === 'dark' ? 'light' : 'dark';
	document.documentElement.dataset.theme = theme.value;
	try {
		localStorage.setItem(KEY, theme.value);
	} catch {
		/* storage unavailable — choice lasts for this visit */
	}
}
