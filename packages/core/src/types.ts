export type Ease = 'linear' | 'ease-in' | 'ease-out' | 'ease-in-out' | 'step';

export type BlendMode = 'normal' | 'multiply' | 'screen' | 'overlay' | 'difference' | 'add';

export type Rect = {
	x: number;
	y: number;
	width: number;
	height: number;
};

export type ParamValue =
	| number
	| string
	| boolean
	| { x: number; y: number }
	| { x: number; y: number }[]
	| null; // paramètre 'file' sans média sélectionné

export type MediaRef = {
	id: string;
	kind: 'image' | 'video';
	name: string;
	mimeType: string;
};

export type ModSource =
	| { kind: 'keyframes'; points: { t: number; value: number; ease: Ease }[] }
	| { kind: 'audio'; band: 'low' | 'mid' | 'high' | 'rms'; smoothing: number }
	| { kind: 'video'; signal: 'luma' | 'motion' | 'contrast'; region?: Rect };

export type Modulation = {
	id: string;
	enabled: boolean;
	target: { moduleId: string; paramKey: string };
	source: ModSource;
	sensitivity: number; // 0..1
	range: [number, number]; // remappage vers la plage utile du paramètre
};

export type ModuleInstance = {
	id: string; // uuid de l'instance
	type: string; // 'traitement.halftone' — identifiant stable, jamais renommé
	enabled: boolean; // « Cacher »
	params: Record<string, ParamValue>;
	blend: { mode: BlendMode; opacity: number }; // commun à tous les modules non-source
};

export type Project = {
	id: string;
	name: string;
	version: 1; // version de schéma, pour la migration
	createdAt: number;
	updatedAt: number;

	format: { ratio: string; width: number; height: number };
	duration: number; // en secondes ; 0 pour une image fixe
	fps: number;

	stack: ModuleInstance[]; // index 0 = source, puis dans l'ordre de rendu
	modulations: Modulation[];
	media: MediaRef[]; // pointeurs vers les blobs stockés dans IndexedDB
};
