export type ToastTone = 'neutral' | 'success' | 'error';
interface Toast {
	id: number;
	message: string;
	tone: ToastTone;
}

let seq = 0;
export const toasts = $state<Toast[]>([]);

export function toast(message: string, tone: ToastTone = 'neutral', ms = 3200) {
	const id = ++seq;
	toasts.push({ id, message, tone });
	setTimeout(() => {
		const i = toasts.findIndex((t) => t.id === id);
		if (i !== -1) toasts.splice(i, 1);
	}, ms);
}
