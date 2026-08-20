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

Après un déploiement : **Réglages → Actualiser l'app**. Le bouton cherche la
nouvelle version, l'installe et recharge. La section affiche au-dessus la
version en place — `colorix-15` au moment d'écrire — ce qui permet de vérifier
que la mise à jour a bien pris.

Sans le bouton, la nouvelle coquille arrive quand même au lancement suivant :
le nouveau service worker s'installe au démarrage, prend la main, et la page se
recharge d'elle-même (`controllerchange` dans `principal.js`). Sans ce
rechargement, il fallait **deux** lancements — le worker s'installait au
premier, la page n'en profitait qu'au second.

**Ne jamais retirer l'app de l'écran d'accueil pour la mettre à jour.** iOS
efface alors son IndexedDB, et tout le travail part avec — c'est ce qui obligeait
à exporter et restaurer à chaque fois.

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
  viseur.js             pose des repères au doigt, loupe ×5, ajustement aux flèches
  zip.js                écriture et lecture ZIP en mode stored
  partage.js            navigator.share avec légende
  paliers.js            seuils des paliers Winx
  preferences.js        localStorage
  symboles.js           reconnaissance des symboles par gabarits
  maj.js                version installée, mise à jour à la demande
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

Un `nuancier` porte la palette de sa planche : ses codes dans l'ordre, leur
couleur relevée, les feutres attribués, et le masque des symboles que la
reconnaissance n'a pas nommés. Ces masques sont de petites images encodées en
`data:` — environ 1,5 Ko pièce — pour que l'export du §9 les emporte avec le
reste plutôt que de les perdre à la sérialisation.

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
| Propositions | Un feutre proposé pour chaque code de la planche, à valider en bloc |
| Pipette | Relevé d'une couleur du livre sur photo de légende |
| Feutres | Inventaire, états, couleurs |
| Import de nuancier | Relevé d'une planche du nuancier papier des feutres, sur photo |
| Statistiques | Progression, paliers, calendrier, mosaïque, palmarès, liste de courses |
| Réglages | Export et import, version et mise à jour, mise en page, albums, stockage |

La fiche coloriage n'a pas de barre d'onglets : c'est un écran de travail. On en
sort par le sur-titre, qui ramène à l'album.

---

## Les données livrées

**`data/catalogue.json`** — 129 livres relevés sur le site de l'éditeur : titre,
auteur, EAN13, année, nombre de pages, couverture locale. Le **nombre de
planches n'existe nulle part chez l'éditeur** : il est demandé à la coche d'un
album, le nombre de pages servant de repère.

Le livre Winx Club porte en plus sa **série de 29 codes stables**, jamais une
constante globale — un autre album aura la sienne. Elle ne porte **aucune
couleur** : la palette change d'une planche à l'autre, elle se relève sur la
page « Mon nuancier » de chaque planche.

```
1 2 3 4 5 6 7 8 9 0 a b c d e f h k m n p q r t u v x y z
```

L'ordre est celui de la légende imprimée : `0` vient après `9`. Les caractères
ambigus `g i j l o s w` sont volontairement écartés par l'éditeur et ne doivent
jamais être proposés.

**Ces vingt-neuf rangs sont les seuls stables.** Une planche qui a davantage de
nuances les note avec des symboles, et ces symboles changent d'identité et
d'ordre d'un coloriage à l'autre : ils appartiennent à la planche, pas au livre.
Le catalogue ne les porte donc pas — l'app les lit sur la photo, voir plus bas.

**`data/nuanciers/guangna-360.json`** — les 360 feutres du Pack 360 :
référence, nom, plus petit pack contenant le feutre, planche et position dans le
nuancier papier. Les hexadécimaux sont vides : ils se relèvent depuis l'app.

---

## Relever le nuancier d'une planche

Fiche coloriage → *Relever le nuancier en photo*.

Chaque planche du livre a sa page « Mon nuancier #N », où sa bande de codes est
imprimée avec **les couleurs de cette planche-là**. Le jeu de codes reste une
propriété du livre, mais une planche en prend **le début, jamais un
sous-ensemble à trous** : 17 nuances sur la planche 47, qui s'arrête à `h`,
davantage sur la 50. Tant qu'une planche n'a pas été relevée, ses cases restent
grises.

Avant la photo, l'écran affiche la série et laisse **taper le dernier code de la
bande** ; le reste se grise. Si la bande continue au-delà de `z`, un compteur
demande **combien de cases à symbole** suivent — on ne les nomme pas, on les
découpe. **C'est ce compte qui découpe la photo, pas le jeu de codes** : un
compte faux ne donne pas un relevé incomplet mais un relevé décalé, chaque
couleur tombant sur le mauvais code.

Quatre repères aux **coins de la bande** donnent l'homographie, un cinquième sur
le blanc de la page donne la référence colorimétrique. Aucune feuille à ajouter
dans le cadre ici : la page est déjà blanche. Et les coins de la bande se visent
bien mieux qu'un centre de case sur une colonne large de trente pixels.

Chaque repère se pose au doigt sous une loupe grossie cinq fois, puis s'affine
**aux quatre flèches**, un pixel d'image par appui — maintenir répète. La loupe
reste ouverte pendant l'ajustement : à l'écran un pixel d'image ne se voit pas,
dans la loupe il en vaut cinq, et le doigt posé sur la flèche ne masque plus la
cible.

Le relevé reste accessible une fois fait : un mauvais cadrage se voit souvent
après coup.

Mesuré sur des bandes de synthèse projetées en perspective — de face, inclinée
à 20°, inclinée et pivotée, en gros plan à 32°, et sur des bandes de 31, 24, 17
et 9 cases — les couleurs sortent exactes. La pose des repères tolère environ
quatre pixels d'écart ; au-delà, les rangées commencent à baver l'une sur
l'autre, ce que l'écran de vérification montre avant l'enregistrement.

### Les symboles, au-delà de « z »

Un symbole est **découpé sur la photo**, puis **reconnu par gabarits** :
`app/symboles.js` dessine les candidats dans quatre fontes et compare les formes
par indice de Jaccard. Un moteur d'OCR pèserait plusieurs mégaoctets de
WebAssembly pour une quinzaine de signes, et lirait mal des caractères isolés et
rares — il est entraîné à lire des mots.

Reconnu, le symbole devient un vrai caractère ; sinon son découpage est gardé en
masque, que les écrans peignent dans l'encre calculée comme ils peindraient un
caractère.

Deux candidats trop proches ne sont jamais départagés — « φ » et « ψ » se
ressemblent — et le découpage l'emporte : un symbole en image vaut mieux qu'un
mauvais caractère. Un tap sur une case de l'écran de vérification refuse le
caractère reconnu et rend son image.

Le découpage se **borne à la case** avant de mesurer quoi que ce soit : on part
de sa couleur relevée et on cherche ses bords, plutôt que de chercher le filet
qui la sépare de la suivante. Chercher le filet reviendrait à parier sur son
épaisseur, et sur une photo l'objectif l'adoucit jusqu'à le rendre indétectable.
Les rangées et les colonnes ne se traitent pas pareil : une rangée qui coupe le
code n'en contient qu'une faible part, donc celle du centre est fiable ; une
colonne du centre suit la hampe du signe sur toute sa hauteur, donc on part des
bords.

Mesuré sur une bande photographiée de synthèse — filets adoucis, léger flou,
JPEG — **10 symboles reconnus sur 16, aucune lecture fausse**. Sur des filets
nets, 12 sur 16. En fonte à empattements, 7 sur 16. Sous un flou extrême, plus
rien n'est reconnu et tout retombe sur l'image : la dégradation est muette,
jamais fausse.

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

## Attribuer les feutres d'un coup

Fiche coloriage → *Proposer les feutres manquants*. Le bouton n'apparaît que
lorsqu'il a de quoi travailler : des codes dont la couleur est relevée mais sans
feutre, et des feutres dont la couleur est relevée.

L'écran propose, pour chaque code à pourvoir, **le feutre le plus proche** parmi
ceux qu'elle possède. Chaque rangée montre côte à côte la couleur du livre et
celle du feutre, la référence en grand, et l'écart ΔE. Un tap écarte une
proposition, un autre la reprend ; le bouton du bas n'attribue que ce qui reste
retenu.

Trois règles de prudence :

- **Rien n'est écrasé.** Un code qui a déjà un feutre n'est pas proposé du tout.
  Pour en changer un, on passe par sa rangée sur la fiche.
- **Au-delà de ΔE 25**, la ligne s'affiche avec son chiffre en magenta mais
  n'est pas retenue d'avance : le plus proche n'est plus une proposition, c'est
  un pis-aller.
- **Un même feutre peut être proposé pour deux codes voisins.** C'est légitime —
  deux teintes proches du livre appellent souvent le même feutre — et c'est à
  elle de trancher.

Les propositions ne piochent que dans les feutres **qui ont un hexadécimal** et
qu'elle **déclare posséder**. Elles s'élargissent donc à chaque planche du
nuancier papier relevée, et un feutre à sec n'est jamais proposé.

L'écran le dit en toutes lettres — *« comparé à 72 feutres dont la couleur est
relevée, sur 360 que tu possèdes »* — et compte les codes sans candidat assez
proche. Sans ce chiffre, une planche à moitié pourvue laisse croire que ses
couleurs sont introuvables, alors que c'est le nuancier des feutres qui est à
moitié relevé.

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

- **Les hexadécimaux des feutres** se relèvent planche par planche depuis l'app.
  Les propositions ne piochent que dans ceux qui en ont : chaque planche relevée
  les élargit.
- **Les palettes des planches** ne sont pas relevées : chaque planche demande la
  photo de sa page « Mon nuancier ».
- **Les seuils des paliers Winx** (`app/paliers.js`) sont posés par déduction,
  calés pour que 37 planches donnent Believix comme la maquette. À valider.
- **Les six couleurs de fées** (`--fee-*` dans `app/styles.css`) sont déduites,
  pas fournies. Accents décoratifs uniquement.
- **V3 et V6** du jalon 0 ne sont pas conclues — persistance à 72 h et durée de
  maintien du Wake Lock.
- **Posca** n'est pas amorcé : seul GuangNa l'est.
