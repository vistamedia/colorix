import { h, naviguer } from '../rendu.js';
import { encreSur } from '../couleur.js';
import { feutres, sets, marques, majFeutre, amorcerSet } from '../donnees.js';
import { compresser, versDonnees } from '../photo.js';
import { extraire, mesurerBlanc, gainsDepuisBlanc, corriger, enHex, qualite } from '../nuancier-photo.js';

const ETAPES = [
  { cle: 'hg', titre: 'Pastille en haut à gauche', aide: 'Vise le centre de la toute première pastille, en haut à gauche de la grille.' },
  { cle: 'hd', titre: 'Pastille en haut à droite', aide: 'La dernière pastille de la même rangée du haut.' },
  { cle: 'bd', titre: 'Pastille en bas à droite', aide: 'La toute dernière pastille, en bas à droite.' },
  { cle: 'bg', titre: 'Pastille en bas à gauche', aide: 'La première pastille de la dernière rangée.' },
  { cle: 'blanc', titre: 'La feuille blanche', aide: 'Pose le repère en plein milieu de la feuille de papier blanc.' }
];

const LOUPE = 132;
const ZOOM = 5;

export async function monter() {
  const [tous, listeSets, listeMarques] = await Promise.all([feutres(), sets(), marques()]);
  const nomMarque = new Map(listeMarques.map(m => [m.id, m.nom]));
  const parSet = new Map(listeSets.map(s => [s.id, s]));

  const planches = new Map();
  for (const f of tous) {
    if (!f.planche) continue;
    const cle = `${f.set_id}|${f.planche}`;
    if (!planches.has(cle)) planches.set(cle, []);
    planches.get(cle).push(f);
  }
  for (const liste of planches.values()) liste.sort((a, b) => a.position - b.position);

  const choix = [...planches.entries()].map(([cle, liste]) => {
    const [setId, numero] = cle.split('|');
    const colonnes = liste.length % 5 === 0 && liste.length / 5 === 10 ? 5 : liste.length / 10;
    return {
      setId, numero: +numero, feutres: liste,
      colonnes: Math.round(colonnes), rangees: Math.round(liste.length / colonnes),
      libelle: `${nomMarque.get(liste[0].marque_id)} · ${parSet.get(setId)?.nom} — planche ${numero}`,
      releves: liste.filter(f => f.hex).length
    };
  }).sort((a, b) => a.numero - b.numero);

  if (!choix.length) {
    /* Un set amorcé avant que les dispositions de planches existent n'a ni
       planche ni position : le ré-amorcer les ajoute sans toucher aux états
       ni aux couleurs déjà relevées. */
    const corps = h('div', { class: 'corps corps--import' });
    if (tous.length) {
      const majSet = h('button', {
        class: 'bouton bouton--primaire',
        onclick: async () => {
          majSet.disabled = true;
          majSet.textContent = 'Mise à jour…';
          await amorcerSet('./data/nuanciers/guangna-360.json');
          location.reload();
        }
      }, 'Mettre le set à jour');
      corps.append(
        h('p', { class: 'section__note' },
          `Tes ${tous.length} feutres ont été amorcés avant que l’app sache comment `
          + 'les planches du nuancier sont disposées. Une mise à jour ajoute cette '
          + 'information — tes états et tes couleurs déjà relevées sont conservés.'),
        majSet);
    } else {
      corps.append(h('p', { class: 'vide' },
        h('strong', {}, 'Aucun set à relever'),
        'Amorce d’abord un set depuis l’écran Feutres.'));
    }
    return { element: h('div', { class: 'vue' }, enteteSimple('Importer un nuancier', '#/feutres'), corps) };
  }

  const vue = h('div', { class: 'vue' });
  let planche = choix[0];
  let image = null;
  const reperes = {};

  /* ---------- étape 1 : planche et photo ---------- */

  function etapeDepart() {
    const selecteur = h('select', {
      class: 'champ champ--select',
      onchange: (e) => { planche = choix[+e.target.value]; }
    }, choix.map((c, i) => h('option', { value: i, selected: c === planche },
      c.libelle + (c.releves ? ` — ${c.releves} relevés` : ''))));

    const entree = h('input', { type: 'file', accept: 'image/*', hidden: true });
    entree.addEventListener('change', async () => {
      const fichier = entree.files[0];
      if (!fichier) return;
      corps.replaceChildren(h('p', { class: 'section__note' }, 'Lecture de la photo…'));
      image = await versDonnees(await compresser(fichier));
      etapeReperes(0);
    });

    const corps = h('div', { class: 'corps corps--import' },
      h('h2', { class: 'section__titre' }, 'Quelle planche relèves-tu ?'),
      selecteur,
      h('p', { class: 'section__note' },
        'Photographie-la à plat, avec une feuille de papier blanc à côté, '
        + 'sans soleil direct ni flash. La feuille sert de référence : c’est elle '
        + 'qui rend les couleurs justes.'),
      h('button', { class: 'bouton--pointille', onclick: () => entree.click() }, '＋ Photo de la planche'),
      entree);

    vue.replaceChildren(enteteSimple('Importer un nuancier', '#/feutres'), corps);
  }

  /* ---------- étape 2 : les repères, un par un ---------- */

  function etapeReperes(index) {
    const etape = ETAPES[index];
    const toile = h('canvas', { class: 'viseur__toile' });
    const loupe = h('canvas', { class: 'loupe-viseur', width: LOUPE, height: LOUPE, hidden: true });
    const marques = h('div', { class: 'viseur__marques' });
    const scene = h('div', { class: 'viseur' }, toile, marques, loupe);

    const suivant = h('button', {
      class: 'bouton bouton--primaire',
      disabled: !reperes[etape.cle],
      onclick: () => index < ETAPES.length - 1 ? etapeReperes(index + 1) : etapeVerification()
    }, index < ETAPES.length - 1 ? 'Suivant' : 'Voir le résultat');

    const dessinerFond = () => {
      const cadre = scene.getBoundingClientRect();
      toile.width = cadre.width;
      toile.height = cadre.height;
      const facteur = Math.min(cadre.width / image.width, cadre.height / image.height);
      const L = image.width * facteur, H = image.height * facteur;
      const dx = (cadre.width - L) / 2, dy = (cadre.height - H) / 2;

      const tampon = new OffscreenCanvas(image.width, image.height);
      tampon.getContext('2d').putImageData(image, 0, 0);
      const p = toile.getContext('2d');
      p.clearRect(0, 0, toile.width, toile.height);
      p.drawImage(tampon, dx, dy, L, H);
      return { facteur, dx, dy, tampon };
    };

    let vue2d = null;
    const versImage = (x, y) => [(x - vue2d.dx) / vue2d.facteur, (y - vue2d.dy) / vue2d.facteur];
    const versEcran = (x, y) => [x * vue2d.facteur + vue2d.dx, y * vue2d.facteur + vue2d.dy];

    const dessinerMarques = () => {
      marques.replaceChildren(...ETAPES.filter(e => reperes[e.cle]).map(e => {
        const [x, y] = versEcran(...reperes[e.cle]);
        const pose = h('span', {
          class: `marque-posee${e.cle === etape.cle ? ' marque-posee--active' : ''}${e.cle === 'blanc' ? ' marque-posee--blanc' : ''}`
        });
        pose.style.left = `${x}px`;
        pose.style.top = `${y}px`;
        return pose;
      }));
    };

    const viser = (evenement) => {
      const point = evenement.touches?.[0] || evenement;
      const cadre = toile.getBoundingClientRect();
      const x = point.clientX - cadre.left;
      const y = point.clientY - cadre.top;
      const [ix, iy] = versImage(x, y);
      if (ix < 0 || iy < 0 || ix >= image.width || iy >= image.height) return;

      reperes[etape.cle] = [ix, iy];
      dessinerMarques();
      suivant.disabled = false;

      const p = loupe.getContext('2d');
      p.imageSmoothingEnabled = false;
      p.clearRect(0, 0, LOUPE, LOUPE);
      const zone = LOUPE / ZOOM;
      p.drawImage(vue2d.tampon, ix - zone / 2, iy - zone / 2, zone, zone, 0, 0, LOUPE, LOUPE);
      p.strokeStyle = '#FFFFFF';
      p.lineWidth = 2;
      p.beginPath();
      p.moveTo(LOUPE / 2, LOUPE / 2 - 14); p.lineTo(LOUPE / 2, LOUPE / 2 + 14);
      p.moveTo(LOUPE / 2 - 14, LOUPE / 2); p.lineTo(LOUPE / 2 + 14, LOUPE / 2);
      p.stroke();

      loupe.hidden = false;
      loupe.style.left = `${Math.max(LOUPE / 2 + 6, Math.min(cadre.width - LOUPE / 2 - 6, x))}px`;
      loupe.style.top = `${Math.max(LOUPE / 2 + 6, y - 20)}px`;
    };

    scene.addEventListener('touchstart', (e) => { e.preventDefault(); viser(e); }, { passive: false });
    scene.addEventListener('touchmove', (e) => { e.preventDefault(); viser(e); }, { passive: false });
    scene.addEventListener('touchend', () => { loupe.hidden = true; });
    scene.addEventListener('mousedown', (e) => {
      viser(e);
      const bouger = (ev) => viser(ev);
      const finir = () => { loupe.hidden = true; removeEventListener('mousemove', bouger); removeEventListener('mouseup', finir); };
      addEventListener('mousemove', bouger);
      addEventListener('mouseup', finir);
    });

    const entete = h('header', { class: 'entete entete--sobre entete--viseur' },
      h('div', { class: 'entete__contenu' },
        h('div', { class: 'viseur__compteur' }, `Repère ${index + 1} sur ${ETAPES.length}`),
        h('h1', { class: 'viseur__titre' }, etape.titre),
        h('p', { class: 'section__note' }, etape.aide)));

    const actions = h('div', { class: 'actions' },
      h('button', {
        class: 'bouton bouton--chrono',
        onclick: () => index ? etapeReperes(index - 1) : etapeDepart()
      }, index ? 'Précédent' : 'Reprendre'),
      suivant);

    vue.replaceChildren(entete, scene, actions);
    requestAnimationFrame(() => {
      vue2d = dessinerFond();
      dessinerMarques();
    });
  }

  /* ---------- étape 3 : vérification ---------- */

  function etapeVerification() {
    const blanc = mesurerBlanc(image, reperes.blanc);
    const gains = blanc && gainsDepuisBlanc(blanc);
    const controle = gains && qualite(blanc, gains);

    const corps = h('div', { class: 'corps corps--import' });

    if (!gains || controle.alertes.some(a => a.gravite === 'echec')) {
      const texte = !gains
        ? 'Le repère de la feuille blanche est mal posé.'
        : controle.alertes.find(a => a.gravite === 'echec').texte;
      corps.append(
        h('p', { class: 'alerte alerte--echec' }, texte),
        h('button', { class: 'bouton--secondaire', onclick: () => etapeReperes(4) }, 'Replacer le repère blanc'),
        h('button', { class: 'bouton--secondaire', onclick: () => etapeDepart() }, 'Reprendre la photo'));
      vue.replaceChildren(enteteSimple('Résultat', '#/feutres'), corps);
      return;
    }

    const cases = extraire(image, [reperes.hg, reperes.hd, reperes.bd, reperes.bg],
      planche.colonnes, planche.rangees);
    const resultats = cases.map((c, i) => ({
      feutre: planche.feutres[i],
      hex: c.brut ? enHex(corriger(c.brut, gains)) : null
    })).filter(x => x.feutre && x.hex);

    const avertissement = controle.alertes.find(a => a.gravite === 'avertissement');

    corps.append(
      h('p', { class: 'section__note' },
        `${resultats.length} couleurs relevées sur la planche ${planche.numero}. `
        + 'Vérifie que les teintes correspondent aux noms — les blancs doivent être blancs, '
        + 'les noirs noirs. Si la grille a glissé, reviens replacer les repères.'),
      avertissement ? h('p', { class: 'alerte alerte--avertissement' }, avertissement.texte) : null,
      h('div', { class: 'import__apercu' }, resultats.map(({ feutre, hex }) =>
        h('div', { class: 'import__case' },
          h('span', { class: 'import__pastille', style: `background:${hex};color:${encreSur(hex)}` }),
          h('span', { class: 'import__ref' }, feutre.reference),
          h('span', { class: 'import__nom' }, feutre.nom)))));

    const enregistrer = h('button', {
      class: 'bouton bouton--primaire',
      onclick: async () => {
        enregistrer.disabled = true;
        enregistrer.textContent = 'Enregistrement…';
        for (const { feutre, hex } of resultats) await majFeutre(feutre.id, { hex });
        naviguer('#/feutres');
      }
    }, `Enregistrer ${resultats.length} couleurs`);

    vue.replaceChildren(
      enteteSimple('Résultat', '#/feutres'),
      corps,
      h('div', { class: 'actions' },
        h('button', { class: 'bouton bouton--chrono', onclick: () => etapeReperes(0) }, 'Repères'),
        enregistrer));
  }

  etapeDepart();
  return { element: vue };
}

function enteteSimple(titre, retour) {
  return h('header', { class: 'entete entete--sobre' },
    h('div', { class: 'entete__contenu' },
      retour && h('a', { class: 'retour retour--sombre', href: retour }, '‹ Mes feutres'),
      h('h1', { class: 'titre-album' }, titre)));
}
