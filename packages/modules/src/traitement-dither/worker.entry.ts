/// <reference lib="webworker" />
// La ligne ci-dessus scope les types `self`/`postMessage` du contexte Worker
// à CE fichier seul, sans changer le tsconfig du paquet (qui reste "dom" —
// manifest.ts et les autres fichiers du paquet tournent dans une page, pas
// un Worker).
//
// Point d'entrée RÉEL du thread Worker (packages/modules/src/traitement-dither/manifest.ts
// l'importe via `?worker`). `worker.ts` ne fournit que `process` — un module
// n'a pas le droit de savoir comment il est exécuté (architecture §4) ; ce
// relais générique (même forme pour tout futur module worker) appartient à
// la mécanique du moteur, pas au procédé lui-même.
import process from './worker.ts';

type ParamValue = number | string | boolean | { x: number; y: number } | { x: number; y: number }[] | null;

type WorkerRequest = {
	requestId: number;
	input: ImageData;
	params: Record<string, ParamValue>;
	ctx: { seed: number; time: number; scale: number };
};

self.onmessage = (event: MessageEvent<WorkerRequest>) => {
	const { requestId, input, params, ctx } = event.data;
	try {
		const output = process(input, params, ctx);
		self.postMessage({ requestId, output }, [output.data.buffer]);
	} catch (err) {
		const message = err instanceof Error ? err.message : String(err);
		self.postMessage({ requestId, error: message });
	}
};
