// `@ulab/modules` n'est importé qu'en `import type` (architecture §6 / ETAPE-2 §3.5) :
// aucune valeur du registre de modules n'entre dans le moteur, seulement sa forme.
import type { ModuleDef } from '@ulab/modules';

/** Le moteur ne connaît un module que par son manifeste — jamais par son type. */
export type RenderableModule = ModuleDef;

export type ModuleResolver = (type: string) => RenderableModule | undefined;
export type MediaResolver = (id: string) => ImageBitmap | undefined;
