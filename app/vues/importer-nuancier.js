import { h, naviguer } from '../rendu.js';
import { encreSur } from '../couleur.js';
import { feutres, sets, marques, majFeutre, amorcerSet } from '../donnees.js';
import { compresser, versDonnees } from '../photo.js';
import { extraire, mesurerBlanc, gainsDepuisBlanc, corriger, enHex, qualite } from '../nuancier-photo.js';
import { ecranReperes } from '../viseur.js';

const ETAPES = [
  { cle: 'hg', titre: 'Pastille en haut à gauche', aide: 'Vise le centre de la toute première pastille, en haut à gauche de la grille.' },
  { cle: 'hd', titre: 'Pastille en haut à droite', aide: 'La dernière pastille de la même rangée du haut.' },
  { cle: 'bd', titre: 'Pastille en bas à droite', aide: 'La toute dernière pastille, en bas à droite.' },
  { cle: 'bg', titre: 'Pastille en bas à gauche', aide: 'La première pastille de la dernière rangée.' },
  { cle: 'blanc', titre: 'La feuille blanche', aide: 'Pose le repère en plein milieu de la feuille de papier blanc.' }
];

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
    vue.replaceChildren(...ecranReperes({
      image, etapes: ETAPES, index, reperes,
      precedent: () => index ? etapeReperes(index - 1) : etapeDepart(),
      suivant: () => index < ETAPES.length - 1 ? etapeReperes(index + 1) : etapeVerification()
    }));
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
      planche.colonnes, planche.rangees, 'centres');
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
