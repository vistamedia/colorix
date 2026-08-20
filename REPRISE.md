# Reprise — Winx Colorix

Je reprends le développement de **Winx Colorix**, une PWA personnelle qui remplace
un carnet papier de coloriages mystère. Une seule utilisatrice (ma fille), un seul
iPhone, aucun compte, aucun serveur, aucune donnée qui sort. L'app est construite,
déployée et utilisée au quotidien ; j'ai des améliorations à te soumettre.

## Accès

- **En ligne** : https://colorix.dananlab.fr/ — version `colorix-18`
- **Dépôt** : https://github.com/vistamedia/colorix — branche `main`, **public**
- **Serveur** : `ssh gata7073@tronc.o2switch.net`, cible
  `/home/gata7073/colorix.dananlab.fr/` (clé SSH déjà en place)

## À lire avant d'écrire du code

1. `README.md` à la racine — ce qui a été construit : architecture, rôle de chaque
   module, les deux relevés photo et leurs mesures, la passe de propositions,
   stockage, service worker, déploiement, points ouverts.
2. `design_handoff_winx_colorix/SPECS.md` — **fait foi sur le fonctionnel**.
   Contient les résultats des six vérifications relevés sur l'appareil, et
   l'historique des trois corrections du §6.0.
3. `design_handoff_winx_colorix/README.md` — valeurs visuelles au pixel : couleurs,
   typographie, rayons, espacements, ombres.

## Contraintes non négociables

- **HTML, CSS, JavaScript natifs. Modules ES. Zéro dépendance, zéro build, pas de
  `package.json`.** Si tu penses avoir besoin d'une bibliothèque, propose-la et
  explique pourquoi, ne l'installe pas. La reconnaissance des symboles a été
  écrite à la main pour cette raison, plutôt que d'embarquer un moteur d'OCR.
- **IndexedDB** pour toutes les données, photos en Blob comprises. `localStorage`
  uniquement pour les préférences légères.
- **Service worker cache-first** : l'app doit démarrer en mode avion.
- **Cible unique : Safari iOS sur iPhone.** Pas de responsive desktop, pas
  d'Android, pas de rétrocompatibilité. Cette contrainte autorise les API récentes
  sans repli.
- **Tout le code est en français** — variables, fonctions, noms de fichiers.
- Pas de code mort, pas de fonction « pour plus tard », pas de commentaire qui
  décrit ce que le code dit déjà. Un commentaire explique **pourquoi**, ou ce qui
  a été payé pour l'apprendre.

## Ce qu'il ne faut pas construire

Aucun écran de connexion, d'inscription, de profil, de tutoriel d'accueil, de
notifications, de fonctions sociales, de commentaires, de classements, de série
quotidienne à ne pas rompre. Ne les ajoute pas « au cas où ».

## Ce que le livre impose, et qui m'a coûté trois corrections

**Une planche observée ne dit rien du livre.** J'ai pris trois fois une planche
pour une règle générale, et trois fois il a fallu défaire. Avant de figer quoi
que ce soit dans `data/catalogue.json` ou dans un modèle, demande-moi de vérifier
sur deux ou trois planches.

- La **série de codes** ne compte que **29 rangs stables**, dans l'ordre de la
  légende imprimée :
  `1 2 3 4 5 6 7 8 9 0 a b c d e f h k m n p q r t u v x y z`.
  Ni numérique ni alphabétique : `0` vient après `9`. Les caractères ambigus
  `g i j l o s w` sont volontairement écartés par l'éditeur.
- **Au-delà de `z`, les symboles appartiennent à la planche**, pas au livre :
  ils changent d'identité **et d'ordre** d'un coloriage à l'autre. L'app les
  découpe sur la photo et les reconnaît par gabarits ; ce qu'elle ne reconnaît
  pas reste une image.
- **La palette appartient à la planche.** Chaque planche a sa page « Mon nuancier
  #N », et le catalogue ne porte aucune couleur. Tant qu'une planche n'est pas
  relevée, ses cases sont grises.
- **Le nombre de nuances varie** — 17 sur la planche 47, 45 sur la 50 — et une
  planche prend toujours **le début** de la série, jamais un sous-ensemble à
  trous. Un compte faux ne tronque pas le relevé : il le **décale**.

L'écran qui compte est la **fiche coloriage** : ouverte quinze fois par soirée, lue
à bout de bras. Contraste maximal, référence de feutre en 40–44 px, aucun décor en
fond de liste, aucune statistique, aucun badge. La cible tactile est la rangée
entière. Tout le reste de l'app peut être médiocre, celui-ci non.

## Ce qui marche aujourd'hui

- **Relevé de la palette d'une planche** en photo — quatre repères aux coins de la
  bande, un cinquième sur le blanc de la page, ajustement aux flèches au pixel.
- **Relevé du nuancier papier des feutres**, même géométrie, avec une feuille
  blanche dans le cadre. Les **360 couleurs du Pack GuangNa sont relevées et
  livrées** dans `data/nuanciers/guangna-360.json`.
- **Propositions ΔE** : une passe propose un feutre pour tous les codes d'une
  planche, à valider en bloc. Mesuré sur 132 codes : écart médian ΔE 7, maximum 15.
- **Symboles nommés à la main** : au-delà de `z`, un tap sur une case ouvre la
  palette des seize signes connus et un champ de saisie. Le découpage est gardé
  quoi qu'il arrive, on peut donc se raviser sans reprendre la photo.
- **Réglages → Actualiser l'app** : cherche la nouvelle version, l'installe,
  recharge, et affiche la version en place.

## Comment je veux travailler

- Explique-moi ce que tu vas faire avant de le faire, en français.
- **Commits au nom d'Emmanuel Danan `<emmanuel.danan@gmail.com>`, sans aucune
  mention de Claude Code** — pas de `Co-Authored-By`, pas de « Generated with ».
  Utilise `git -c user.name="Emmanuel Danan" -c user.email="emmanuel.danan@gmail.com" commit`.
- Déploie et vérifie en ligne après chaque changement, puis dis-moi quoi tester.
- **Mesure plutôt que d'affirmer.** Les essais de géométrie et de colorimétrie se
  font en Node sur images de synthèse — mais fabrique-les comme des photos,
  filets adoucis et JPEG compris : une bande aux traits nets m'a caché un défaut
  que le vrai papier a révélé.
- Si j'ai des données à te donner, je les charge dans mon **Chrome Desktop** sur
  l'app en ligne ; le navigateur intégré a un profil séparé et ne les voit pas.

## Déploiement, et les pièges déjà payés

```bash
rsync -az app data index.html sw.js manifest.webmanifest .htaccess polices icons \
  gata7073@tronc.o2switch.net:/home/gata7073/colorix.dananlab.fr/
```

- **Incrémente `CACHE` dans `sw.js` à chaque changement de la coquille**, sinon
  l'appareil garde l'ancienne version. Le précache force déjà le réseau via
  `new Request(url, { cache: 'reload' })` — ne pas retirer.
- `rsync` place chaque source sous son **nom de base** : `data/nuanciers` atterrit
  dans `nuanciers/` à la racine, pas dans `data/nuanciers/`.
- LiteSpeed mémorise les réponses **404** : une URL testée avant son déploiement
  continue de renvoyer 404. Remède : supprimer le fichier côté serveur puis le
  re-téléverser.
- Devant un « fichier pas déployé », compare le fichier **sur le disque du
  serveur** (`ssh … grep`), pas seulement la réponse HTTP.
- Attention aux faux négatifs de `grep` : une route en expression régulière
  contient `feutres\/importer`, que `grep 'feutres/importer'` ne trouve pas.
- Pour tester dans le navigateur, **vide les caches et désenregistre le service
  worker** après chaque édition, sinon tu éprouves l'ancienne version.
- **`node --check` ne parse pas un module ES** : il valide un fichier dont
  `import()` échoue à la lecture. Vérifier avec
  `node --input-type=module -e "import('./app/vues/x.js').catch(...)"`, sinon
  une parenthèse mal placée part en production.
- L'enregistrement du service worker est dans `index.html`, **hors du graphe de
  modules** : ne pas le remettre dans `principal.js`. Une erreur de syntaxe y
  rendrait l'écran blanc définitif, l'app ne pouvant plus recevoir son
  correctif.
- **Ne me dis jamais de retirer l'app de l'écran d'accueil** pour la mettre à
  jour : iOS efface son IndexedDB et tout le travail part avec.
- **Ne pas écraser `/verifications/`** : c'est la page de diagnostic du jalon 0,
  encore utile.

## Ce qui reste ouvert

- Les **palettes des planches** se relèvent une par une ; quatre le sont.
- **Posca** n'est pas amorcé, seul GuangNa l'est.
- Les **seuils des paliers Winx** (`app/paliers.js`) et les **six couleurs de fées**
  (`--fee-*` dans `app/styles.css`) sont déduits, pas fournis. À valider.
- **V3 et V6** du jalon 0 ne sont pas conclues : persistance à 72 h, et durée de
  maintien du Wake Lock écran allumé.
- Le dépôt étant public, `data/couvertures/` et `photos-nuancier/` sont exclus par
  `.gitignore` tout en étant déployés. Les données de l'app, elles, n'ont aucun
  caractère confidentiel.

---

**Les améliorations que je veux te soumettre :**

<!-- décrire ici ce qu'il y a à faire -->
