# Handoff — Winx Colorix

Destinataire : Claude Code. Rédigé pour être suffisant seul : un développeur qui
n'a pas assisté aux échanges doit pouvoir implémenter à partir de ce document.

---

## 1. Vue d'ensemble

PWA mono-utilisatrice, hors ligne, iPhone uniquement. Elle remplace un carnet
papier : pour chaque planche d'un livre de coloriage mystère, elle tient la
correspondance entre les codes imprimés dans le livre et les références de ses
propres feutres. Elle suit sa collection, photographie ses résultats, consulte
ses statistiques.

Deux documents de référence sont joints et **font foi sur le fonctionnel** :

- `SPECS.md` — architecture, modèle de données, comportements, jalons
- `BRIEF-DESIGN.md` — cadrage de l'interface

Ce README ne remplace pas `SPECS.md`. Il documente **précisément l'habillage**
des deux écrans déjà dessinés, et ce qu'il faut en déduire pour les suivants.

## 2. À propos des fichiers de design joints

Les fichiers `.dc.html` de ce dossier sont des **références de design**, pas du
code à reprendre tel quel. Ce sont des prototypes HTML qui montrent l'apparence
et le comportement voulus ; ils s'appuient sur un runtime de maquettage
(`support.js`) qui n'a rien à faire dans l'application.

Le travail consiste à **recréer ces écrans dans l'environnement cible**. Ici
l'environnement est imposé par `SPECS.md` §3 et il est volontairement pauvre :

> HTML / CSS / JavaScript natifs, modules ES, **zéro dépendance, zéro build**.
> IndexedDB pour tout. Service worker cache-first. Cible unique : Safari iOS sur
> iPhone 14 Plus.

Pas de React, pas de bundler, pas de framework CSS. Les valeurs ci-dessous sont
à poser en variables CSS dans une feuille unique et en HTML rendu côté client
par des modules ES.

**Ne pas commencer l'application avant les vérifications V1 → V6 de `SPECS.md`
§2.** Chacune peut invalider un choix d'architecture, en particulier V4 (HEIC vs
JPEG à la capture) et V6 (Wake Lock dans la web app installée).

## 3. Fidélité

**Haute fidélité.** Couleurs, typographie, tailles, rayons et espacements
ci-dessous sont définitifs et à reproduire au pixel. Les deux écrans ont été
dessinés à 428 × 926 pt, la taille exacte de l'appareil cible.

Deux réserves explicites, à faire trancher par l'utilisatrice avant de figer :

1. **Les six dominantes de couleur des fées** ont été déduites, pas fournies.
   Elles ne servent que d'accents décoratifs — les corriger ne touche à rien de
   structurel.
2. **Les correspondances code → feutre** de la planche 24 sont la lecture d'un
   carnet manuscrit. `7` et `0` pointent tous deux vers GuangNa 878, ce qui est
   peut-être une erreur de lecture. Ce sont des données de démonstration : elles
   n'existent que pour remplir la maquette, l'app les recevra d'IndexedDB.

---

## 4. Jetons de design

### 4.1 Couleurs

Encre et surfaces neutres — c'est la base de l'outil, elle porte tout l'écran de
travail.

| Rôle | Hex |
|---|---|
| Encre principale | `#2A1B36` |
| Texte secondaire | `#6B5680` |
| Texte tertiaire, libellés | `#9B7FB2` |
| Fond application | `#FCFAFD` |
| Surface blanche (barres) | `#FFFFFF` |
| Séparateur de ligne | `#F3EDF7` |
| Bordure structurante | `#EFE6F4` |
| Bordure de bouton | `#E2D3EC` |
| Bordure pointillée | `#D9C6E6` |
| Fond hors appareil (canevas de maquette seulement) | `#EEE9F2` |
| Contour d'appareil (maquette seulement) | `#17101E` |

Identité — violet profond vers magenta, les codes de la série 2D des débuts.

| Rôle | Hex |
|---|---|
| Magenta primaire | `#C4218F` |
| Magenta pressé / lien survolé | `#8E1268` |
| Violet moyen | `#7A2B7E` |
| Violet nuit | `#3B1E5C` |
| Or (éclats, paliers) | `#FFC22E` |
| Or clair (texte sur violet) | `#FFE9B8` |

États et surfaces teintées.

| Rôle | Fond | Texte / bordure |
|---|---|---|
| Statut « En cours » | `#FFE9B8` | `#7A4E00` |
| Bloc « à attribuer » | `#FFF4FA` | bordure `#F6DCEA`, anneau de pastille `#F0B7D4`, texte secondaire `#B07398` |
| Badge feutre superposé | `#F4ECF9` | `#5B3A78` |
| Tuile de planche non commencée | `#F4EEF8` | numéro `#C9B6D8` |
| Référence manquante (texte « à attribuer ») | — | `#C4218F` |

Les six fées — **accents uniquement** (barres de progression, points de chrono,
graphiques de statistiques). Jamais en fond de nuancier : elles entreraient en
concurrence avec les pastilles du livre, qui doivent être fidèles.

| Fée | Hex |
|---|---|
| Bloom | `#F2542D` |
| Stella | `#FFC22E` |
| Flora | `#63C36A` |
| Musa | `#7A4BC4` |
| Tecna | `#17AFA6` |
| Aisha | `#2C7BE8` |

Dégradés.

| Rôle | Valeur |
|---|---|
| En-tête d'écran décoratif | `linear-gradient(150deg, #3B1E5C 0%, #7A2B7E 55%, #C4218F 100%)` |
| Bouton primaire habillé | `linear-gradient(120deg, #C4218F, #7A2B7E)` |
| Progression du nuancier (six fées) | `linear-gradient(90deg, #F2542D, #FFC22E 34%, #63C36A 62%, #2C7BE8)` |
| Progression d'album | `linear-gradient(90deg, #FFC22E, #FFF)` sur fond `rgba(255,255,255,.24)` |
| Halo doré d'en-tête | `radial-gradient(closest-side, #FFC22E, transparent 70%)`, opacité `.22`–`.25` |

Encre sur pastille de couleur : calculée, jamais choisie à la main. Luminance
`(0.299·R + 0.587·G + 0.114·B) / 255` ; au-dessus de `0.62` →
`rgba(20,10,28,.72)`, sinon `rgba(255,255,255,.95)`. Indispensable : les 31
pastilles vont du noir au jaune vif.

### 4.2 Typographie

Deux familles, chargées en local dans l'app (pas de CDN : l'app doit fonctionner
en mode avion).

- **Baloo 2** — titres, boutons primaires, paliers. Graisses 500 à 800.
- **Space Grotesk** — tout le reste, et surtout les chiffres. Graisses 400 à 700.

Toutes les références de feutre et toutes les durées portent
`font-variant-numeric: tabular-nums`.

| Usage | Valeur |
|---|---|
| Référence de feutre, mise en page A | `700 40px/1 Space Grotesk`, `letter-spacing: -.01em` |
| Référence de feutre, mise en page B | `700 44px/1 Space Grotesk`, `letter-spacing: -.015em` |
| Référence de feutre superposé | `700 22px` (A) · `700 19px/1.1` (B) |
| Titre de planche | `700 38px/1 Baloo 2` (A) · `800 40px/1.05` (B) |
| Titre d'écran (« Ma collection ») | `800 40px/1.05 Baloo 2` |
| Titre d'album ouvert | `800 32px/1.08 Baloo 2` |
| Titre d'album en liste | `700 19px/1.15 Baloo 2` |
| Code sur pastille carrée | `700 21px Space Grotesk` |
| Code sur bande pleine (B) | `700 30px Space Grotesk` |
| Code sur pastille « à attribuer » | `700 24px Space Grotesk` |
| Nom de teinte du livre | `400 13px` |
| Marque de feutre | `600 12px`, `letter-spacing: .07em`, majuscules |
| Sur-titre (nom d'album au-dessus du numéro) | `600 12px`, `letter-spacing: .1em`, majuscules |
| Chip de statut | `700 13px Space Grotesk` |
| Bouton primaire | `700 21px Baloo 2` (20px sur pleine largeur) |
| Bouton chrono | `600 20px Space Grotesk` |
| Bouton secondaire | `600 14px Space Grotesk` |
| Barre d'onglets | `700 11px` (actif) · `600 11px` (inactif) |
| Compteur de progression | `600 13px` · `700 14px` sur fond coloré |

Plancher absolu : **13 px**, et seulement pour un libellé secondaire. L'écran de
travail est lu à bout de bras, en oblique, sans lunettes.

### 4.3 Espacements, rayons, ombres

- Marge latérale d'écran : **20 px** (22 px dans l'en-tête de la bibliothèque)
- Zone de sécurité haute : **58–60 px** de padding en tête d'écran ; barre d'état
  superposée sur 54 px
- Zone de sécurité basse : **28–30 px** de padding sous la dernière rangée
  d'actions ; indicateur d'accueil 140 × 5, rayon 999, `#2A1B36` à 35 %
- Rangée de nuancier : padding `11px 20px`, hauteur minimale **66 px** (A) /
  **74 px** (B)
- Écarts : 14 px entre cartes, 12 px entre boutons d'une rangée, 10 px dans la
  grille de planches, 9 px entre pastilles « à attribuer »

Rayons : pastille de nuancier **14**, pastille « à attribuer » **16**, badge de
superposition **12**, tuile de planche **16**, couverture d'album **12**, carte
d'album **22**, bouton principal **20**, bouton secondaire **14**, pilule **999**.

Ombres :

- Carte d'album : `0 2px 0 rgba(42,27,54,.06), 0 10px 24px -18px rgba(42,27,54,.5)`
- Barre d'actions basse : `0 -10px 24px -18px rgba(42,27,54,.5)`
- Pastille de couleur : `inset 0 0 0 1px rgba(20,10,28,.14)` — un liseré, jamais
  une ombre portée : la couleur imprimée doit rester lisible telle quelle
- Pastille « à attribuer » : `inset 0 0 0 1px rgba(20,10,28,.16), 0 0 0 2px #FFF4FA, 0 0 0 3.5px #F0B7D4`
- Tuile de planche : `inset 0 0 0 1px rgba(42,27,54,.07)`
- Planche en cours : `inset 0 0 0 3px #C4218F`

### 4.4 Le motif d'ailes

Le seul ornement, et il est en CSS pur — aucun visuel sous droits, aucun SVG à
fournir. Deux ailes concentriques, en contour uniquement, dans l'angle supérieur
droit des en-têtes décoratifs :

```css
border-radius: 100% 8% 100% 8%;
border: 2px solid rgba(255,255,255,.28);  /* .16 à .18 pour la seconde */
transform: rotate(-14deg);                /* -6 à -8deg pour la seconde */
```

Grande aile 176 × 138, petite 124 × 100, décalée vers l'intérieur. Deux ou trois
éclats : cercles de 5 à 7 px, blancs ou `#FFE9B8`, en
`animation: wcGlow 2.6s–3.4s ease-in-out infinite` où `wcGlow` fait varier
l'opacité de `.5` à `1`. Durées désaccordées pour éviter le clignotement
synchrone.

`@media (prefers-reduced-motion: reduce)` → figer les éclats à `opacity: .8`.

---

## 5. Écran 1 — Fiche coloriage

**But.** L'écran ouvert pendant qu'elle colorie, consulté quinze fois par
soirée. Tout le reste de l'app peut être médiocre, celui-ci non.

**Deux mises en page ont été produites**, à trancher après essai sur
l'appareil. Elles partagent l'en-tête, la barre d'actions et toutes les valeurs
typographiques ; elles diffèrent sur la présentation de la liste.

### 5.1 Structure commune

Colonne verticale de haut en bas, hauteur d'écran fixe, une seule zone qui
défile :

1. Barre d'état système superposée (54 px, non interactive)
2. En-tête : sur-titre `COLORIAGES MYSTÈRES · WINX CLUB`, titre `Planche 24`,
   chip `En cours` aligné à droite, puis barre de progression + `15 / 31 codes`
3. **Liste du nuancier** — `flex: 1; overflow-y: auto;` plus
   `-webkit-overflow-scrolling: touch`. 31 rangées : c'est la seule partie qui
   défile, et elle doit défiler.
4. Barre d'actions basse, fixe, sur fond `#FFFFFF` : bouton chrono à gauche
   (largeur au contenu), bouton `Terminé ✦` à droite (largeur restante), tous
   deux **62 px de haut**

### 5.2 Mise en page A — ordre du livre, sobre

Aucun décor. En-tête sur fond `#FCFAFD`, barre d'état en encre foncée.

Chaque rangée, de gauche à droite :

- pastille carrée **46 × 46**, rayon 14, remplie de la couleur imprimée dans le
  livre, le caractère du code centré dedans
- bloc de texte : la **référence du feutre en 40 px**, la marque en 12 px
  majuscules à sa droite sur la même ligne de base, le nom de teinte du livre en
  13 px en dessous
- si deux feutres : un second bloc à droite, séparé par un filet vertical
  `2px #F3EDF7`, référence en 22 px et libellé `+ DESSUS` en 10 px
- si aucun feutre : la référence est remplacée par le texte `à attribuer` en
  `#C4218F`, et un `＋` de 26 px en `#E0AFCF` ferme la rangée à droite

Les 31 codes sont dans l'ordre du livre, non attribués compris, à leur place.

### 5.3 Mise en page B — manquants en tête, bandes pleines

En-tête sur le dégradé d'identité, barre d'état en blanc, ailes et éclats.

Sous l'en-tête, un bloc `#FFF4FA` : titre `16 codes t'attendent encore` en
`700 15px Baloo 2` `#C4218F`, mention `tape pour choisir` à droite, puis une
**bande horizontale défilante** de pastilles **56 × 56** (rayon 16, anneau rose),
une par code non attribué. Défilement horizontal, `gap: 9px`, débord visible pour
signaler qu'il y en a d'autres.

Puis la liste des seuls codes attribués. Chaque rangée : **bande de couleur
pleine de 74 px de large** sur toute la hauteur de la rangée, le code en 30 px
réservé dedans, puis la référence en 44 px et `marque · nom de teinte` en 13 px
en dessous. Feutre superposé : badge `#F4ECF9` à droite.

La barre d'actions gagne une ligne au-dessus : bouton secondaire pointillé
`Reprendre le nuancier de la planche 19`, 40 px de haut.

### 5.4 Comportements

| Élément | Comportement |
|---|---|
| Écran entier | Wake Lock demandé à l'entrée, relâché à la sortie. Si l'API échoue, ne rien afficher : l'app ne doit pas se plaindre. |
| Rangée de nuancier | Tap → écran d'attribution du feutre pour ce code. Cible tactile : la rangée entière, jamais la seule pastille. |
| Pastille « à attribuer » (B) | Tap → même destination. 56 × 56, au-dessus du minimum de 44 pt. |
| Bouton chrono | Un seul bouton, bascule marche / arrêt. Pas de compte à rebours, pas de remise à zéro visible. Cumule dans `duree_cumulee_s`. |
| `Terminé` | Demande le sujet révélé (texte libre), puis propose la photo. Fait passer le statut à `termine` et pose `date_fin`. |
| `Reprendre le nuancier de…` | Copie les entrées d'un autre coloriage du même album, puis laisse ajuster. Proposer la planche terminée la plus récente. |
| État pressé | Boutons secondaires : fond `#F6EFFA`. Bouton primaire uni : `#433054`. |

**Interdits sur cet écran** (`SPECS.md` §5) : statistiques, badges, suggestions,
notifications, décor en fond de liste.

---

## 6. Écran 2 — Bibliothèque

**But.** L'écran d'entrée et le visage de l'app. C'est ici que vit le décoratif.

### 6.1 Vue « Mes albums »

En-tête sur le dégradé d'identité, ailes, halo doré, éclats. Titre
`Ma collection`, puis **trois tuiles de résumé** en `rgba(255,255,255,.16)` avec
`backdrop-filter: blur(6px)`, rayon 16 : planches finies, albums possédés,
palier Winx atteint. Le palier s'écrit en Baloo 2 17 px `#FFE9B8`.

Puis la liste des albums, une carte par album, rayon 22, fond blanc, padding 12,
écart 14 :

- couverture **78 × 104**, rayon 12. En attendant l'image de l'éditeur, un
  **repli de couleur** (dégradé) avec le titre court en `700 12px Baloo 2` en bas
  à gauche. Ce repli n'est pas un placeholder de maquette : `SPECS.md` §4.1 le
  prévoit comme état permanent hors ligne.
- à droite : titre en 19 px Baloo 2, `éditeur · année` en 12 px `#9B7FB2`, puis
  en bas une barre de progression de 9 px (rayon 999, piste `#F0EAF5`, remplissage
  au dégradé de la couverture) et `12 sur 50` en `600 13px`

Puis un bouton pointillé pleine largeur, 58 px,
`＋ Cocher un album du catalogue`.

Barre d'onglets basse à quatre entrées : Albums · Feutres · Stats · Réglages.
L'onglet actif porte un fond `#F8EFF6`, rayon 14, et son libellé en `#C4218F` ;
les autres en `#9B7FB2`. Les glyphes de la maquette (`◆ ▤ ✦ ⚙`) sont des
substituts : prévoir de vraies icônes en trait, 2 px, coins arrondis.

### 6.2 Vue « Album ouvert »

Même en-tête, plus un retour `‹ Ma collection` au-dessus du titre, et la
progression `24 sur 50` sur toute la largeur.

**Grille de planches, trois colonnes, écart 10 px, tuiles carrées, rayon 16.**
C'est l'écran qui doit donner envie d'en remplir une de plus. Trois états :

| État | Rendu |
|---|---|
| Terminée | La photo du résultat en `object-fit: cover`, et le numéro sur deux chiffres en pilule `rgba(23,16,30,.62)` + `blur(3px)`, 11 px blanc, en haut à gauche |
| En cours | Fond `#FFF4FA`, liseré intérieur `3px #C4218F`, numéro en `800 34px Baloo 2` `#C4218F`, mention `EN COURS` en 10 px majuscules |
| Pas commencée | Fond `#F4EEF8`, numéro en `600 24px` `#C9B6D8` |

Numéros toujours sur deux chiffres (`01`, `24`) : la grille reste régulière.

Barre d'action basse, bouton pleine largeur 60 px au dégradé :
`Reprendre la planche 24 ✦`.

**Dans la maquette**, les tuiles terminées sont des emplacements d'image vides
(`image-slot.js`) pour que l'utilisatrice y dépose ses vraies photos pendant la
revue. Dans l'application, ce sont les `Photo.blob` d'IndexedDB, servies via
`URL.createObjectURL` et révoquées à la sortie de l'écran. **`image-slot.js`
n'a rien à faire dans l'application.**

---

## 7. État et données

Le modèle complet est dans `SPECS.md` §4 et fait foi. Rappels utiles à ces deux
écrans :

- `Coloriage.statut` : `pas_commence | en_cours | termine` — pilote les trois
  états de tuile et le chip d'en-tête
- `Nuancier.entrees[]` : une `Entree` par code du livre, avec `pastille_hex`
  (la couleur imprimée, pipettée) et `feutres[]` **ordonné** — l'ordre est la
  superposition, il porte du sens, ne pas le trier
- Le jeu de codes est une **propriété du livre**, pas une constante globale

**Le jeu de codes de l'album Winx Club — 31 caractères, dans cet ordre :**

```
1 2 3 4 5 6 7 8 9 0 a b c d e f h k m n p q r t u v x y z ◊ Δ
```

Les caractères ambigus sont volontairement écartés par l'éditeur : `g i j l o s
w` ne doivent **jamais** être proposés. Noter que `0` vient après `9`, et que
`◊` et `Δ` ferment la série — l'ordre n'est ni alphabétique ni numérique, c'est
l'ordre de la légende imprimée.

Données de démonstration de la planche 24, telles qu'utilisées dans les
maquettes. Les teintes sont approximatives, relevées à l'œil sur le nuancier du
livre, et destinées à être remplacées par des valeurs pipettées.

| Code | Teinte | Hex | Feutre |
|---|---|---|---|
| `1` | noir bleuté | `#141A24` | Posca 8018 |
| `2` | kaki clair | `#A8A86A` | GuangNa 657 |
| `3` | bleu profond | `#1E3A8A` | GuangNa 746 |
| `4` | bleu moyen | `#2E63C8` | GuangNa 634 |
| `5` | bleu ciel | `#4FA6E8` | GuangNa 650 |
| `6` | bleu clair | `#86C9F2` | GuangNa 888 |
| `7` | bleu très clair | `#C3E4F9` | GuangNa 878 |
| `8` | noir | `#0B0B0D` | — |
| `9` | bleu-gris foncé | `#46586E` | — |
| `0` | violet foncé | `#4A2A78` | GuangNa 878 |
| `a` | violet | `#7A4BC4` | — |
| `b` | lavande | `#B9A6E8` | — |
| `c` | prune très foncé | `#3A1030` | GuangNa 925 + Posca 8018 |
| `d` | bordeaux | `#7A1230` | — |
| `e` | framboise | `#C42150` | GuangNa 916 |
| `f` | rose vif | `#F0428A` | GuangNa 910 |
| `h` | magenta | `#D6219B` | — |
| `k` | rose moyen | `#F27BAE` | — |
| `m` | rose clair | `#F9B8CE` | — |
| `n` | terracotta | `#C4653A` | — |
| `p` | beige rosé | `#EFCDBC` | — |
| `q` | rose pâle | `#F7D3DE` | GuangNa 913 |
| `r` | rouge | `#DC2020` | — |
| `t` | orange | `#F27A16` | — |
| `u` | jaune orangé | `#FBB014` | — |
| `v` | jaune | `#FADA1E` | — |
| `x` | gris très foncé | `#2A2A2E` | — |
| `y` | gris-vert foncé | `#4C5A46` | — |
| `z` | vert foncé | `#1E6B34` | GuangNa 794 |
| `◊` | vert moyen | `#35A34C` | GuangNa 649 |
| `Δ` | vert clair | `#8FD070` | GuangNa 645 |

15 attribués, 16 à attribuer. `c` est le seul code à deux feutres superposés :
c'est le cas qui prouve la fonctionnalité, le garder dans les jeux d'essai.

Le petit texte sous la référence est le **nom de teinte du livre**, pas un nom
commercial de feutre. Quand `Feutre.nom` sera renseigné depuis les nuanciers de
référence (`data/nuanciers/guangna-360.json`, `posca.json`), il pourra le
remplacer — mais ne jamais inventer un nom de couleur absent des données.

---

## 8. Ce qu'il ne faut pas construire

`BRIEF-DESIGN.md` §9 : pas d'écran de connexion, d'inscription, de profil, de
tutoriel d'accueil, de notifications, de fonctions sociales internes, de
commentaires, de classements, de série quotidienne à ne pas rompre. Rien de tout
cela n'existe dans l'app.

## 9. Écrans encore à dessiner

Ils n'ont pas de maquette : attribution d'un feutre à un code, inventaire des
feutres, pipette sur photo de légende, statistiques et mosaïque annuelle, paliers
de progression, réglages et sauvegarde. Les construire sur les jetons de la
§4. Règle de partage entre les deux registres :

- **Outil** (attribution, inventaire, pipette) → la grammaire de la mise en page
  A : fond `#FCFAFD`, pas de dégradé, contraste maximal, typographie large
- **Vitrine** (statistiques, mosaïque, paliers) → la grammaire de la bibliothèque :
  en-tête au dégradé, ailes, éclats, or

## 10. Ressources

**Icônes, manifeste et coquille PWA : voir `icons/README.md`.** Ce dossier contient
les PNG du manifeste, l'`apple-touch-icon` 180 × 180 qu'iOS exige, un
`manifest.webmanifest` prêt à servir, les balises `<head>`, la gestion des zones
de sécurité et les consignes de service worker.

Le décor est intégralement en CSS — y compris la marque. Les deux familles de
caractères — **Baloo 2** et **Space Grotesk** — sont sous licence SIL Open Font
License et doivent être **embarquées dans l'app** en `woff2`, pas chargées depuis
un CDN : l'app doit démarrer en mode avion. Charger uniquement les graisses
utilisées : Baloo 2 700 et 800, Space Grotesk 400, 600, 700.

Les couvertures d'album viennent des URL de l'éditeur (`SPECS.md` §4.1), mises en
cache après premier affichage, avec le repli de couleur décrit en §6.1.

## 11. Fichiers de ce dossier

| Fichier | Rôle |
|---|---|
| `README.md` | Ce document |
| `PROMPT-CLAUDE-CODE.md` | Le prompt à coller dans Claude Code pour lancer l'implémentation |
| `SPECS.md` | Spécifications fonctionnelles — fait foi |
| `BRIEF-DESIGN.md` | Cadrage de l'interface |
| `Fiche coloriage.dc.html` | Maquette écran 1, mises en page A (`1a`) et B (`1b`) |
| `Bibliothèque.dc.html` | Maquette écran 2, vues « mes albums » (`2a`) et « album ouvert » (`2b`) |
| `support.js` | Runtime de maquettage — **à ne pas porter** |
| `Icônes.dc.html` | Source de la marque et des icônes, dessinée en CSS |
| `image-slot.js` | Emplacements photo de la maquette — **à ne pas porter** |
| `icons/` | Icônes PNG, manifeste, coquille PWA — voir son propre README |
| `captures/` | Captures des quatre vues, à 2× (856 × 1852) |

Ouvrir les `.dc.html` dans un navigateur pour voir les écrans côte à côte.

| Capture | Vue |
|---|---|
| `captures/ecran1-fiche-A.png` | Fiche coloriage, mise en page A |
| `captures/ecran1-fiche-B.png` | Fiche coloriage, mise en page B |
| `captures/ecran2-albums.png` | Bibliothèque, mes albums |
| `captures/ecran2-album-ouvert.png` | Bibliothèque, album ouvert |

Les captures montrent le haut des listes défilantes ; les maquettes HTML sont la
référence pour le reste.
