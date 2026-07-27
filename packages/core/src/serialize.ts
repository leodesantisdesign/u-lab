import type { Project } from './types.ts';

const CURRENT_VERSION = 1;

type ProjectData = Record<string, unknown>;
type Migration = (data: ProjectData) => ProjectData;

// Migration de la version N vers N+1, indexée par N. Vide tant que `version`
// n'a jamais été incrémentée — voir docs/U.LAB-ARCHITECTURE.md §3.
const migrations: Record<number, Migration> = {};

export function toUlab(project: Project): string {
	return JSON.stringify(project, null, 2);
}

export function fromUlab(json: string): Project {
	let data = JSON.parse(json) as ProjectData;

	const version = data.version;
	if (typeof version !== 'number') {
		throw new Error('Fichier .ulab invalide : champ "version" manquant ou non numérique.');
	}
	if (version > CURRENT_VERSION) {
		throw new Error(
			`Fichier .ulab en version ${version}, plus récente que celle supportée (${CURRENT_VERSION}).`,
		);
	}

	let from = version;
	while (from < CURRENT_VERSION) {
		const migrate = migrations[from];
		if (!migrate) {
			throw new Error(`Aucune migration disponible de la version ${from} vers ${from + 1}.`);
		}
		data = migrate(data);
		from += 1;
	}

	return data as unknown as Project;
}
