import type { ModuleDef } from '../types.ts';

// Plage et défaut (0, neutre) repris de fxParams.ts
// (EFFECT_META.chromaticShift). Contrairement aux autres finitions, 0 est ici
// la seule valeur réellement neutre : un décalage non nul favorise
// arbitrairement une direction, ça n'a pas de sens comme réglage par défaut.
export const manifest: ModuleDef = {
	type: 'finition.aberration',
	category: 'finition',
	name: 'Aberration chromatique',
	summary: 'Décale les canaux rouge et bleu en sens opposés.',
	thumbnail: './thumbnail.webp',
	params: [
		{
			key: 'shift',
			label: 'Décalage',
			type: 'number',
			min: -24,
			max: 24,
			step: 1,
			default: 0,
			unit: 'px',
		},
	],
	render: { kind: 'shader', fragment: '// TODO(Étape 2)' },
};
