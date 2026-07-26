# U.LAB

Un laboratoire d'outils créatifs web, gratuits, sans compte et sans paywall.
Image, vidéo, motion, design graphique/web, 3D, code art. Chaque outil fait
un seul process, à fond, en temps réel, dans le navigateur — sans backend.

Voir [CLAUDE.md](./CLAUDE.md) pour les décisions de fond et
[docs/U.LAB-ARCHITECTURE.md](./docs/U.LAB-ARCHITECTURE.md) pour le détail
technique et le plan de migration.

## Lancer le projet

```bash
corepack enable pnpm   # si pnpm n'est pas déjà activé
pnpm install
pnpm dev                # lance tous les outils/apps en dev
pnpm build              # build tous les packages/apps
```

## Structure

```
apps/lab/       # site Astro : accueil, navigation, pages outils
tools/          # 1 outil = 1 dossier = 1 idée (u-dither, u-halftone, ...)
packages/       # moteur de rendu, design system, palettes, export — partagés
_legacy/        # ancien code, référence fonctionnelle uniquement
```
