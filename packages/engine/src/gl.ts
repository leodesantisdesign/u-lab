/**
 * Contexte WebGL2, compilation et cache de programmes.
 * ETAPE-2.md §3.6 : « un programme compilé une fois par type de module, mis en
 * cache. Les uniformes se mettent à jour, ils ne se recompilent pas. »
 */

export class WebGL2UnavailableError extends Error {
	constructor() {
		super('WebGL2 est indisponible sur ce navigateur ou ce contexte.');
		this.name = 'WebGL2UnavailableError';
	}
}

export class ShaderCompileError extends Error {
	constructor(
		public readonly moduleType: string,
		public readonly log: string,
		stage: 'vertex' | 'fragment',
	) {
		super(`Échec de compilation du shader ${stage} pour le module "${moduleType}" :\n${log}`);
		this.name = 'ShaderCompileError';
	}
}

export class ProgramLinkError extends Error {
	constructor(
		public readonly moduleType: string,
		public readonly log: string,
	) {
		super(`Échec de l'édition de liens du programme pour le module "${moduleType}" :\n${log}`);
		this.name = 'ProgramLinkError';
	}
}

/**
 * `HTMLCanvasElement` pour l'aperçu (le canevas injecté dans `createRenderer`),
 * `OffscreenCanvas` pour `renderToBitmap` — l'export ne doit toucher aucun
 * élément DOM en dehors de ce canevas injecté.
 */
export type UlabCanvas = HTMLCanvasElement | OffscreenCanvas;

export function createGLContext(canvas: UlabCanvas): WebGL2RenderingContext {
	// Les deux types de canevas ont un `getContext('webgl2', options)`
	// structurellement identique ; on fixe le surcharge via un seul cast plutôt
	// que de dupliquer l'appel par branche.
	const gl = (canvas as HTMLCanvasElement).getContext('webgl2', {
		antialias: false,
		preserveDrawingBuffer: false,
		alpha: true,
	}) as WebGL2RenderingContext | null;
	if (!gl) throw new WebGL2UnavailableError();
	return gl;
}

function compileShader(
	gl: WebGL2RenderingContext,
	kind: 'vertex' | 'fragment',
	source: string,
	moduleType: string,
): WebGLShader {
	const type = kind === 'vertex' ? gl.VERTEX_SHADER : gl.FRAGMENT_SHADER;
	const shader = gl.createShader(type);
	if (!shader) throw new ShaderCompileError(moduleType, "impossible d'allouer le shader", kind);

	gl.shaderSource(shader, source);
	gl.compileShader(shader);

	if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
		const log = gl.getShaderInfoLog(shader) ?? '(pas de log)';
		gl.deleteShader(shader);
		throw new ShaderCompileError(moduleType, log, kind);
	}

	return shader;
}

function linkProgram(
	gl: WebGL2RenderingContext,
	vertex: WebGLShader,
	fragment: WebGLShader,
	moduleType: string,
): WebGLProgram {
	const program = gl.createProgram();
	if (!program) throw new ProgramLinkError(moduleType, "impossible d'allouer le programme");

	gl.attachShader(program, vertex);
	gl.attachShader(program, fragment);
	gl.linkProgram(program);

	if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
		const log = gl.getProgramInfoLog(program) ?? '(pas de log)';
		gl.deleteProgram(program);
		throw new ProgramLinkError(moduleType, log);
	}

	return program;
}

/**
 * Un programme par type de module. La clé est le `type` du module
 * (`traitement.halftone`), pas l'id d'instance : deux instances du même
 * module partagent leur programme, seules leurs uniformes diffèrent.
 */
export class ProgramCache {
	private readonly programs = new Map<string, WebGLProgram>();

	constructor(private readonly gl: WebGL2RenderingContext) {}

	get(moduleType: string, vertexSource: string, fragmentSource: string): WebGLProgram {
		const cached = this.programs.get(moduleType);
		if (cached) return cached;

		const vertex = compileShader(this.gl, 'vertex', vertexSource, moduleType);
		const fragment = compileShader(this.gl, 'fragment', fragmentSource, moduleType);
		let program: WebGLProgram;
		try {
			program = linkProgram(this.gl, vertex, fragment, moduleType);
		} finally {
			this.gl.deleteShader(vertex);
			this.gl.deleteShader(fragment);
		}

		this.programs.set(moduleType, program);
		return program;
	}

	/** Retire un module du cache — utile après une perte de contexte. */
	invalidate(moduleType: string): void {
		const program = this.programs.get(moduleType);
		if (!program) return;
		this.gl.deleteProgram(program);
		this.programs.delete(moduleType);
	}

	dispose(): void {
		for (const program of this.programs.values()) this.gl.deleteProgram(program);
		this.programs.clear();
	}
}
