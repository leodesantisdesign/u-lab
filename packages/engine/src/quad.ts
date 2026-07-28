/**
 * Le triangle plein écran, fourni par le moteur (ETAPE-2.md §3.1 : un module
 * ne fournit jamais de vertex shader). Un seul triangle, deux fois plus grand
 * que le viewport de chaque côté — pas un quad à deux triangles, pas de
 * buffer d'attributs : les trois positions viennent de `gl_VertexID`.
 *
 * `vUv` est dérivé des mêmes positions, en 0..1, origine bas-gauche.
 */
export const QUAD_VERTEX_SHADER = `#version 300 es

const vec2 POSITIONS[3] = vec2[3](
  vec2(-1.0, -1.0),
  vec2(3.0, -1.0),
  vec2(-1.0, 3.0)
);

out vec2 vUv;

void main() {
  vec2 position = POSITIONS[gl_VertexID];
  vUv = position * 0.5 + 0.5;
  gl_Position = vec4(position, 0.0, 1.0);
}
`;

/**
 * WebGL2 exige un VAO lié pour dessiner, même sans attribut de sommet
 * (les positions viennent de `gl_VertexID` dans le shader ci-dessus).
 */
export class FullscreenTriangle {
	private readonly vao: WebGLVertexArrayObject;

	constructor(private readonly gl: WebGL2RenderingContext) {
		const vao = gl.createVertexArray();
		if (!vao) throw new Error('Impossible de créer le VAO du triangle plein écran.');
		this.vao = vao;
	}

	draw(): void {
		this.gl.bindVertexArray(this.vao);
		this.gl.drawArrays(this.gl.TRIANGLES, 0, 3);
	}

	dispose(): void {
		this.gl.deleteVertexArray(this.vao);
	}
}
