const DIACRITICS = new RegExp('[\\u0300-\\u036f]', 'g');

function toKebabCase(name: string): string {
	const slug = name
		.normalize('NFD')
		.replace(DIACRITICS, '')
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, '-')
		.replace(/^-+|-+$/g, '');
	return slug || 'sans-titre';
}

function pad(n: number): string {
	return String(n).padStart(2, '0');
}

function timestamp(date: Date): string {
	const yyyy = date.getFullYear();
	const mm = pad(date.getMonth() + 1);
	const dd = pad(date.getDate());
	const hh = pad(date.getHours());
	const min = pad(date.getMinutes());
	return `${yyyy}${mm}${dd}-${hh}${min}`;
}

/** `ulab-<nom-de-projet-en-kebab>-<AAAAMMJJ-HHMM>.<ext>` */
export function exportFilename(projectName: string, ext: string, date: Date = new Date()): string {
	return `ulab-${toKebabCase(projectName)}-${timestamp(date)}.${ext}`;
}
