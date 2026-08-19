# Icônes et coquille PWA

Tout ce dossier est du livrable prêt à poser. Les PNG sont générés depuis
`Icônes.dc.html`, qui reste la source : la marque est dessinée en CSS, il n'y a
aucun fichier binaire d'origine à retrouver.

## La marque

Quatre ailes en blanc plein, symétriques, sur le dégradé d'identité, avec un
éclat doré en losange au-dessus. Aucun personnage, aucun visuel sous droits :
c'est le même motif d'ailes que les en-têtes de l'app, ici en plein plutôt qu'en
contour, pour tenir à 40 px.

Construction, dans une zone de 512 × 512 :

| Élément | Position | Taille | Rayons | Rotation |
|---|---|---|---|---|
| Aile haute gauche | 88, 147 | 168 × 176 | `100% 100% 6% 100%` | `-7deg`, origine bas droite |
| Aile haute droite | 256, 147 | 168 × 176 | `100% 100% 100% 6%` | `7deg`, origine bas gauche |
| Aile basse gauche | 150, 317 | 106 × 126 | `100% 6% 100% 100%` | `7deg`, origine haut droite |
| Aile basse droite | 256, 317 | 106 × 126 | `6% 100% 100% 100%` | `-7deg`, origine haut gauche |
| Nervure (× 2, ailes hautes) | 126 / 280, 178 | 106 × 112 | idem aile | idem aile |
| Éclat | 230, 77 | 52 × 52 | `15px 4px 15px 4px` | `45deg` |

Ailes en `#FFFFFF`, nervures en `#C4218F` à 15 % d'opacité, éclat en `#FFC22E`.
Fond : `linear-gradient(150deg, #3B1E5C 0%, #7A2B7E 54%, #C4218F 100%)`, plus un
halo doré `radial-gradient(closest-side, #FFC22E, transparent 70%)` de 460 px
débordant en haut à droite (opacité .34) et un halo bleu `#2C7BE8` de 380 px
débordant en bas à gauche (opacité .2).

Les nervures disparaissent visuellement sous 64 px : c'est voulu, la silhouette
suffit. Ne pas les épaissir pour les « sauver ».

## Fichiers

| Fichier | Usage |
|---|---|
| `icon-192.png` | Manifeste, `purpose: any` |
| `icon-512.png` | Manifeste, `purpose: any` |
| `icon-512-maskable.png` | Manifeste, `purpose: maskable` — marque réduite à 72 % pour tenir dans la zone sûre |
| `apple-touch-icon.png` | 180 × 180, iOS. **Indispensable** : c'est cette image qu'iOS utilise à l'ajout sur l'écran d'accueil, il ignore les icônes du manifeste |
| `splash-1284x2778.png` | Écran de lancement iOS, iPhone 14 Plus. **Indispensable** : iOS n'utilise pas `background_color`, sans cette image le lancement montre une page blanche |
| `manifest.webmanifest` | Manifeste complet, prêt à servir |

À produire en plus, non fournis ici :

- Les **autres tailles d'écran de lancement** si l'app est un jour installée sur
  un autre iPhone. Le gabarit est dans `Icônes.dc.html` (`#splash`) : dégradé
  d'identité, deux ailes en contour très discrètes dans les angles opposés,
  marque blanche de 148 px de large centrée, `Colorix` en Baloo 2 800 40 px,
  `NUANCIERS` en Space Grotesk 600 13 px `letter-spacing: .22em` à 60 % de blanc.
  Le groupe est centré avec 56 px de décalage vers le haut : l'œil lit le centre
  optique, pas le centre géométrique.
- Un `favicon.ico` ou `icon.svg` si l'app est aussi ouverte au navigateur.

## À poser dans `<head>`

```html
<meta name="viewport"
      content="width=device-width, initial-scale=1, viewport-fit=cover">
<meta name="theme-color" content="#3B1E5C">
<link rel="manifest" href="./manifest.webmanifest">
<link rel="apple-touch-icon" href="./icons/apple-touch-icon.png">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
<meta name="apple-mobile-web-app-title" content="Colorix">
<link rel="apple-touch-startup-image"
      href="./icons/splash-1284x2778.png"
      media="(device-width: 428px) and (device-height: 926px)
             and (-webkit-device-pixel-ratio: 3)">
```

`viewport-fit=cover` plus `black-translucent` donnent le plein écran voulu par le
brief : l'app passe sous la barre d'état et sous l'indicateur d'accueil. Les
zones de sécurité deviennent alors la responsabilité du CSS :

```css
:root {
  --safe-top:    env(safe-area-inset-top,    0px);
  --safe-bottom: env(safe-area-inset-bottom, 0px);
}
```

Les valeurs d'espacement du README principal (§4.3) sont mesurées **avec** ces
zones : 58–60 px en tête d'écran correspond à `calc(var(--safe-top) + 14px)`, et
28–30 px en pied à `calc(var(--safe-bottom) + 12px)`.

Deux réglages sans lesquels l'app ne se comporte pas comme une app :

```css
* { -webkit-tap-highlight-color: transparent; }
body { overscroll-behavior: none; user-select: none; }
```

`user-select: none` sur le corps, mais **à réactiver** sur les champs de saisie
(sujet révélé, notes, recherche de feutre) : `user-select: text`.

## Service worker

Cache-first sur la coquille, conformément à `SPECS.md` §3. La liste précachée
doit inclure les icônes, les deux polices en `woff2`, et les fichiers de données
livrés avec l'app (`data/catalogue.json`, `data/nuanciers/*.json`).

Les couvertures d'album, elles, viennent de l'éditeur : cache **à la demande**
après premier affichage, jamais précachées, avec repli sur la pastille de
couleur décrite au README principal §6.1.

Rappels de `SPECS.md` §2, à vérifier sur l'appareil avant d'écrire du code :
l'app doit s'ouvrir en mode avion (V2), et le stockage doit survivre 72 h avec
~50 Mo dedans (V3). Demander `navigator.storage.persist()` au premier
lancement.
