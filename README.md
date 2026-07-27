# U.LAB

Un atelier de création visuelle dans le navigateur, gratuit, sans compte et
sans paywall. On charge une photo ou une vidéo, on empile des procédés
(dither, halftone, ASCII, pixel sort, grain…), on règle chaque procédé un par
un, et on exporte en image ou en vidéo. Tout en temps réel, sans backend —
les fichiers ne quittent jamais la machine.

Voir [CLAUDE.md](./CLAUDE.md) pour les décisions de fond et
[docs/U.LAB-ARCHITECTURE.md](./docs/U.LAB-ARCHITECTURE.md) pour le modèle de
document, le registre de modules et le plan d'étapes.

## Lancer le projet

```bash
corepack enable pnpm   # si pnpm n'est pas déjà activé
pnpm install
pnpm dev                # lance le site en dev
pnpm build              # build tous les packages/apps
```

## Structure

```
apps/lab/            # site Astro : accueil, galerie de modèles, /create, pages d'effets
packages/core/       # modèle de document, store, historique, .ulab, IndexedDB
packages/engine/     # WebGL2/WebGPU : passes, ping-pong, sources, rendu
packages/modules/    # le registre : un dossier par module (manifeste + shader)
packages/modulation/ # keyframes, signaux vidéo, analyse audio
packages/palette/    # palettes partagées et quantification
packages/ui/         # design system + inspecteur généré depuis les manifestes
packages/export/     # export image et vidéo
_legacy/             # ancien code, référence fonctionnelle uniquement
```

**Un module = un procédé. Une seule surface de création : `/create`.**
