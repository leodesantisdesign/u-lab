export type ModuleCategory = 'source' | 'traitement' | 'finition';

export type RenderKind = 'shader' | 'worker' | 'compute';

export type ShaderRenderDef = {
	kind: 'shader';
	/** Corps GLSL de `ulab_main` (ETAPE-2.md §3.1) — jamais un programme complet. */
	fragment: string;
};

export type WorkerRenderDef = {
	kind: 'worker';
	// Constructeur Worker (import Vite `?worker` sur un fichier qui relaie
	// vers `process`, ETAPE-2.md §3.3) — le moteur fait `new worker()`, jamais
	// un import direct : c'est ainsi qu'un module `worker` reste utilisable
	// sans que packages/engine importe une valeur de @ulab/modules.
	worker: new () => Worker;
};

// 'compute' (pixel sort, WebGPU) : pas encore de forme, hors périmètre de
// cette étape (docs/U.LAB-TRAMAGE.md §3). RenderKind le garde nommable sans
// que RenderDef invente une forme non implémentée.
export type RenderDef = ShaderRenderDef | WorkerRenderDef;

type ParamCommon<T extends string> = {
	key: string;
	label: string;
	type: T;
	unit?: string;
};

export type NumberParamDef = ParamCommon<'number'> & {
	min: number;
	max: number;
	step: number;
	default: number;
};

export type EnumParamDef = ParamCommon<'enum'> & {
	options: string[];
	default: string;
};

export type BooleanParamDef = ParamCommon<'boolean'> & {
	default: boolean;
};

export type ColorParamDef = ParamCommon<'color'> & {
	default: string; // hex, ex. '#FF6606'
};

export type PointParamDef = ParamCommon<'point'> & {
	default: { x: number; y: number };
};

export type TextParamDef = ParamCommon<'text'> & {
	default: string;
};

export type FileParamDef = ParamCommon<'file'> & {
	default: string | null; // référence de média (MediaRef.id), absente si null
};

export type PaletteParamDef = ParamCommon<'palette'> & {
	default: string; // nom d'une palette de @ulab/palette, ou 'aucune'
};

export type ParamDef =
	| NumberParamDef
	| EnumParamDef
	| BooleanParamDef
	| ColorParamDef
	| PointParamDef
	| TextParamDef
	| FileParamDef
	| PaletteParamDef;

export type ModuleDef = {
	type: string; // 'traitement.halftone' — identifiant stable, jamais renommé
	category: ModuleCategory;
	name: string;
	summary: string;
	thumbnail: string;
	params: ParamDef[];
	render: RenderDef;
	// Listé dans le modal, grisé et non sélectionnable, avec la mention
	// « bientôt » — pour un module qui annonce une étape à venir (ETAPE-2.md
	// §2 : source.video et source.webcam annoncent l'étape 4) sans être
	// masqué. Absent ou false : module normalement sélectionnable.
	comingSoon?: boolean;
};
