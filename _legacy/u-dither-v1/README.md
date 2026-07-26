# U.DITHER

Web app de dithering artistique orientée image, vidéo, palettes et post FX.

Les previews image, l'extraction de palette et les exports PNG tournent côté frontend dans un Web Worker. L'affichage de preview utilise Canvas/WebGL2 quand le navigateur le supporte. Le backend Python reste dédié au rendu MP4 final via ffmpeg.

## Modes
- Halftone / dot screen
- Bayer / ordered dithering
- Floyd-Steinberg
- Atkinson

## Couleur
- `Mono ink` : rendu noir/blanc classique
- `Keep source colors` : garde les couleurs de l'image
- `RGB channels` : traite les canaux rouge, vert et bleu séparément

## Palettes
- Game Boy
- CGA
- Macintosh 1-bit
- PICO-8
- Warm Print
- Cold Signal
- Acid Orange
- Custom + extraction automatique

## Vidéo
- endpoint `POST /render_video`
- formats UI : MP4, MOV, WEBM
- réglages : 24/25 fps, largeur max jusqu'à 1920 px, durée max 60s, conservation audio
- Full HD : choisir `1920 / FULL HD` donne du `1920x1080` sur une source 16:9
- preview rapide `PREVIEW 1S` avant rendu complet
- nécessite `ffmpeg` et `ffprobe` installés localement

## Lancer
Depuis ce dossier :

```bash
cd "/Users/leode/Desktop/PERSO/U.DITHER/app"
```

Terminal 1 :

```bash
npm run backend
```

Terminal 2 :

```bash
npm run frontend
```

Si un port est déjà pris :

```bash
npm run check:ports
```

Commandes équivalentes sans scripts :

- Backend : `PYTHONPATH=api/src /opt/anaconda3/bin/python -m uvicorn udither_api.app:app --host 127.0.0.1 --port 8001 --reload`
- Frontend : `cd web && VITE_UDITHER_API_BASE=http://127.0.0.1:8001 npm run dev`
- Si tu changes le port backend : `VITE_UDITHER_API_BASE=http://127.0.0.1:XXXX npm run dev`

Si FastAPI indique que `python-multipart` manque :

```bash
/opt/anaconda3/bin/python -m pip install python-multipart
```

## Exports
- PNG still en 1X/2X/4X
- MP4 vidéo avec le look courant
