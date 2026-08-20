# Winx Colorix

PWA de suivi de coloriages mystère et de correspondance de nuanciers.
Mono-utilisatrice, hors ligne, iPhone.

**En ligne :** https://colorix.dananlab.fr/
**Diagnostic du jalon 0 :** https://colorix.dananlab.fr/verifications/

Les intentions et le modèle de données font foi dans
`design_handoff_winx_colorix/SPECS.md`. Les valeurs visuelles — couleurs,
typographie, rayons, espacements — sont dans `design_handoff_winx_colorix/README.md`.
Ce document-ci décrit ce qui a été construit.

---

## Installation sur l'appareil

Ouvrir l'URL dans Safari, puis Partager → **Sur l'écran d'accueil**. L'app
s'ouvre ensuite en plein écran depuis son icône, sans barre Safari, et
fonctionne en mode avion.

Après un déploiement, fermer complètement l'app depuis le sélecteur avant de la
rouvrir : le service worker n'installe le nouveau cache qu'au lancement suivant.

---

## Architecture

HTML, CSS et JavaScript natifs. Modules ES. **Aucune dépendance, aucun build,
pas de `package.json`.** Tout ce qui est servi est exactement ce qui est écrit.

```
index.html              coquille et balises PWA
manifest.webmanifest
sw.js                   service worker, cache-first sur la coquille
app/
  styles.css            tous les jetons de design
  principal.js          routeur par hash, démarrage
  base.js               accès IndexedDB promisifié
  donnees.js            opérations métier
  couleur.js            encre sur pastille, sRGB → Lab, ΔE76
  photo.js              compression 1600 px / qualité 0.8
  nuancier-photo.js     homographie, échantillonnage, correction du blanc
  viseur.js             pose des repères au doigt, loupe ×5
  zip.js                écriture et lecture ZIP en mode stored
  partage.js            navigator.share avec légende
  paliers.js            seuils des paliers Winx
  preferences.js        localStorage
  rendu.js              fabrique d'éléments, icônes, dégradés de repli
  vues/                 un module par écran
data/
  catalogue.json        129 livres relevés chez l'éditeur, sans couleurs
  nuanciers/            nuanciers de référence livrés avec l'app
  couvertures/          vignettes locales, hors dépôt
polices/                Baloo 2 et Space Grotesk en woff2 (SIL OFL)
icons/                  icônes, écran de lancement
verifications/          page de diagnostic du jalon 0, autonome
```

### Stockage

IndexedDB pour tout, y compris les photos en `Blob` : `possessions`,
`coloriages`, `nuanciers`, `marques`, `sets`, `feutres`, `photos`.
`localStorage` uniquement pour les préférences légères — mise en page de la
fiche, date du dernier export.

### Service worker

Cache-first sur la coquille. Le précache force le réseau
(`new Request(url, { cache: 'reload' })`) : sans cela il recopie la version que
le cache HTTP détient encore, et la mise à jour n'atteint jamais l'appareil.
**Incrémenter `CACHE` dans `sw.js` à chaque changement de la coquille.**

Les couvertures d'album ne sont jamais précachées : cache à la demande après
premier affichage, repli sur un dégradé de couleur.

---

## Les écrans

| Écran | Rôle |
|---|---|
| Bibliothèque | Albums possédés, progression, palier atteint |
| Catalogue | Les 129 livres, recherche, coche d'un album |
| Album | Grille des planches — pas commencée, en cours, terminée avec sa photo |
| **Fiche coloriage** | L'écran de travail : les codes du livre et leurs feutres |
| Relevé du nuancier | Les couleurs d'une planche, lues sur sa page « Mon nuancier » |
| Attribution | Feutres d'un code, superposition ordonnée, recherche, propositions ΔE |
| Pipette | Relevé d'une couleur du livre sur photo de légende |
| Feutres | Inventaire, états, couleurs |
| Import de nuancier | Relevé des couleurs d'une planche entière sur photo |
| Statistiques | Progression, paliers, calendrier, mosaïque, palmarès, liste de courses |
| Réglages | Export et import, mise en page de la fiche, albums, stockage |

La fiche coloriage n'a pas de barre d'onglets : c'est un écran de travail. On en
sort par le sur-titre, qui ramène à l'album.

---

## Les données livrées

**`data/catalogue.json`** — 129 livres relevés sur le site de l'éditeur : titre,
auteur, EAN13, année, nombre de pages, couverture locale. Le **nombre de
planches n'existe nulle part chez l'éditeur** : il est demandé à la coche d'un
album, le nombre de pages servant de repère.

Le livre Winx Club porte en plus son **jeu de 31 codes**. Le jeu de codes est une
propriété du livre, jamais une constante globale — un autre album aura un autre
jeu. Il ne porte **aucune couleur** : la palette change d'une planche à l'autre,
elle se relève sur la page « Mon nuancier » de chaque planche.

```
1 2 3 4 5 6 7 8 9 0 a b c d e f h k m n p q r t u v x y z ◊ Δ
```

L'ordre est celui de la légende imprimée : `0` vient après `9`, `◊` (U+25CA) et
`Δ` (U+0394) ferment la série. Les caractères ambigus `g i j l o s w` sont
volontairement écartés par l'éditeur et ne doivent jamais être proposés.

**`data/nuanciers/guangna-360.json`** — les 360 feutres du Pack 360 :
référence, nom, plus petit pack contenant le feutre, planche et position dans le
nuancier papier. Les hexadécimaux sont vides : ils se relèvent depuis l'app.

---

## Relever le nuancier d'une planche

Fiche coloriage → *Relever le nuancier en photo*.

Chaque planche du livre a sa page « Mon nuancier #N », où sa bande de codes est
imprimée avec **les couleurs de cette planche-là**. Le jeu de codes reste une
propriété du livre, mais une planche n'en emploie pas forcément la totalité : le
nombre de nuances varie d'un coloriage à l'autre. Tant qu'une planche n'a pas
été relevée, ses cases restent grises.

Avant la photo, l'écran propose les codes du livre et laisse décocher ceux qui
ne sont pas sur la bande. **C'est ce compte qui découpe la photo, pas le jeu de
codes** : un compte faux ne donne pas un relevé incomplet mais un relevé décalé,
chaque couleur tombant sur le mauvais code.

Quatre repères aux **coins de la bande** donnent l'homographie, un cinquième sur
le blanc de la page donne la référence colorimétrique. Ici, aucune feuille à
ajouter dans le cadre : la page est déjà blanche. Les coins de la bande se
visent bien mieux qu'un centre de case sur une colonne large de trente pixels.

Le relevé reste accessible une fois fait : un mauvais cadrage se voit souvent
après coup.

Mesuré sur des bandes de synthèse projetées en perspective — de face, inclinée
à 20°, inclinée et pivotée, en gros plan à 32°, et sur des bandes de 31, 24, 17
et 9 cases — les couleurs sortent exactes. La pose des repères tolère environ
quatre pixels d'écart ; au-delà, les rangées commencent à baver l'une sur
l'autre, ce que l'écran de vérification montre avant l'enregistrement.

## Relever les couleurs d'un nuancier de feutres

Feutres → *Relever les couleurs sur photo*.

Photographier une planche **avec une feuille de papier blanc à côté, dans le
cadre** : c'est la seule condition indispensable. Le papier de la carte étant
lui-même coloré, il ne peut pas servir de référence, et sans référence neutre la
teinte du papier, la température de la lumière et le gradient d'éclairage sont
indissociables.

Puis cinq repères au doigt, un par un, avec une loupe grossie cinq fois : les
quatre pastilles des coins donnent l'homographie, la feuille blanche donne la
correction de von Kries en espace linéaire.

Mesuré sur une planche de synthèse soumise à une dominante bleue : écart moyen
aux couleurs vraies **ΔE 14,3 sans correction, 2,9 avec**.

Les propositions automatiques du jalon 3 restent muettes tant qu'un feutre n'a
pas d'hexadécimal — plutôt que de proposer du faux.

---

## Sauvegarde

Réglages → **Exporter tout** produit une archive ZIP contenant `data.json` et le
dossier `photos/`, écrite en mode *stored* : les JPEG sont déjà compressés.
L'import restaure ou fusionne, après confirmation.

`navigator.storage.persist()` est refusé par Safari iOS, y compris en web app
installée. Rien ne garantit donc la conservation des données par contrat — d'où
le poids de l'export.

---

## Déploiement

```bash
rsync -az app data index.html sw.js manifest.webmanifest .htaccess polices icons \
  gata7073@tronc.o2switch.net:/home/gata7073/colorix.dananlab.fr/
```

Attention : `rsync` place chaque source sous son nom de base. `data/nuanciers`
atterrit dans `nuanciers/` à la racine, pas dans `data/nuanciers/` — envoyer
`data` entier, ou préciser la destination complète.

Le `.htaccess` déclare le type MIME du manifeste et interdit la mise en cache du
service worker.

---

## Ce qui reste ouvert

- **Les hexadécimaux des 360 feutres** ne sont pas renseignés. À relever planche
  par planche depuis l'app.
- **Les palettes des planches** ne sont pas relevées : chaque planche demande la
  photo de sa page « Mon nuancier ».
- **Les seuils des paliers Winx** (`app/paliers.js`) sont posés par déduction,
  calés pour que 37 planches donnent Believix comme la maquette. À valider.
- **Les six couleurs de fées** (`--fee-*` dans `app/styles.css`) sont déduites,
  pas fournies. Accents décoratifs uniquement.
- **V3 et V6** du jalon 0 ne sont pas conclues — persistance à 72 h et durée de
  maintien du Wake Lock.
- **Posca** n'est pas amorcé : seul GuangNa l'est.
