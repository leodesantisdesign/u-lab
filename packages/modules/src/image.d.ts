// Astro traite un import '*.webp' nu comme un asset optimisé (objet
// ImageMetadata, pas une chaîne) : `?url` force l'URL brute — c'est tout ce
// qu'un ModuleDef.thumbnail (string) attend.
declare module '*.webp?url' {
	const url: string;
	export default url;
}
