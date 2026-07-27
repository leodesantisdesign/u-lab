export type ModuleCategory = 'source' | 'traitement' | 'finition';

export type RenderKind = 'shader' | 'worker' | 'compute';

export type RenderDef = {
	kind: RenderKind;
	// Placeholder à cette étape (aucun shader/worker réel avant l'Étape 2) —
	// deviendra la source GLSL, le module worker ou le kernel compute selon `kind`.
	fragment: string;
};

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

export type ParamDef =
	| NumberParamDef
	| EnumParamDef
	| BooleanParamDef
	| ColorParamDef
	| PointParamDef
	| TextParamDef
	| FileParamDef;

export type ModuleDef = {
	type: string; // 'traitement.halftone' — identifiant stable, jamais renommé
	category: ModuleCategory;
	name: string;
	summary: string;
	thumbnail: string;
	params: ParamDef[];
	render: RenderDef;
};
