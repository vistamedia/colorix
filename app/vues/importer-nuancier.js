import { h, naviguer } from '../rendu.js';
import { encreSur } from '../couleur.js';
import { feutres, sets, marques, majFeutre } from '../donnees.js';
import { compresser, versDonnees } from '../photo.js';
import { extraire, mesurerBlanc, gainsDepuisBlanc, corriger, enHex, qualite, projeter, homographie } from '../nuancier-photo.js';

const REPERES = [
  { cle: 'hg', libelle: '1', aide: 'pastille en haut à gauche' },
  { cle: 'hd', libelle: '2', aide: 'pastille en haut à droite' },
  { cle: 'bd', libelle: '3', aide: 'pastille en bas à droite' },
  { cle: 'bg', libelle: '4', aide: 'pastille en bas à gauche' },
  { cle: 'blanc', libelle: '✦', aide: 'sur la feuille blanche' }
];

export async function monter() {
  const [tous, listeSets, listeMarques] = await Promise.all([feutres(), sets(), marques()]);
  if (!tous.length) {
    return {
      element: h('div', { class: 'vue' },
        h('header', { class: 'entete entete--sobre' },
          h('div', { class: 'entete__contenu' },
            h('a', { class: 'retour retour--sombre', href: '#/feutres' }, '‹ Mes feutres'),
            h('h1', { class: 'titre-album' }, 'Importer un nuancier'))),
        h('p', { class: 'vide' },
          h('strong', {}, 'Aucun set'),
          'Amorce d’abord un set depuis l’écran Feutres.'))
    };
  }

  const nomMarque = new Map(listeMarques.map(m => [m.id, m.nom]));
  const parSet = new Map(listeSets.map(s => [s.id, s]));
  const planchesDuSet = new Map();
  for (const f of tous) {
    if (!f.planche) continue;
    const cle = `${f.set_id}|${f.planche}`;
    if (!planchesDuSet.has(cle)) planchesDuSet.set(cle, []);
    planchesDuSet.get(cle).push(f);
  }
  for (const liste of planchesDuSet.values()) liste.sort((a, b) => a.position - b.position);

  const choix = [...planchesDuSet.entries()]
    .map(([cle, liste]) => {
      const [setId, planche] = cle.split('|');
      const colonnes = liste.length === 50 ? 5 : 4;
      return {
        cle, setId, planche: +planche, feutres: liste, colonnes,
        rangees: liste.length / colonnes,
        libelle: `${nomMarque.get(liste[0].marque_id)} · ${parSet.get(setId)?.nom} — planche ${planche}`,
        renseignes: liste.filter(f => f.hex).length
      };
    })
    .sort((a, b) => a.planche - b.planche);

  let planche = choix[0];
  let image = null;
  let reperes = null;
  let resultats = null;

  const toile = h('canvas', { class: 'import__toile' });
  const calques = h('div', { class: 'import__calques' });
  const scene = h('div', { class: 'import__scene' }, toile, calques);
  const journal = h('p', { class: 'section__note' });
  const apercu = h('div', { class: 'import__apercu' });

  const selecteur = h('select', { class: 'champ champ--select', onchange: (e) => {
    planche = choix[+e.target.value];
    poserReperes();
    rafraichir();
  } }, choix.map((c, i) => h('option', { value: i },
    `${c.libelle}${c.renseignes ? ` — ${c.renseignes} déjà relevés` : ''}`)));

  const entreePhoto = h('input', { type: 'file', accept: 'image/*', hidden: true });
  entreePhoto.addEventListener('change', async () => {
    const fichier = entreePhoto.files[0];
    if (!fichier) return;
    journal.textContent = 'Lecture de la photo…';
    image = await versDonnees(await compresser(fichier));
    toile.width = image.width;
    toile.height = image.height;
    toile.getContext('2d').putImageData(image, 0, 0);
    scene.classList.add('import__scene--chargee');
    poserReperes();
    rafraichir();
  });

  function poserReperes() {
    if (!image) return;
    const { width: L, height: H } = image;
    reperes = {
      hg: [L * 0.22, H * 0.22], hd: [L * 0.78, H * 0.22],
      bd: [L * 0.78, H * 0.80], bg: [L * 0.22, H * 0.80],
      blanc: [L * 0.06, H * 0.06]
    };
    dessinerReperes();
  }

  function dessinerReperes() {
    calques.replaceChildren(...REPERES.map(({ cle, libelle }) => {
      const point = h('button', { class: `repere repere--${cle}`, 'data-cle': cle }, libelle);
      const deplacer = (evenement) => {
        const p = evenement.touches?.[0] || evenement;
        const cadre = toile.getBoundingClientRect();
        reperes[cle] = [
          Math.max(0, Math.min(image.width, (p.clientX - cadre.left) / cadre.width * image.width)),
          Math.max(0, Math.min(image.height, (p.clientY - cadre.top) / cadre.height * image.height))
        ];
        placer(point, cle);
        rafraichir();
      };
      point.addEventListener('touchmove', (e) => { e.preventDefault(); deplacer(e); }, { passive: false });
      point.addEventListener('mousedown', () => {
        const bouger = (e) => deplacer(e);
        const finir = () => { removeEventListener('mousemove', bouger); removeEventListener('mouseup', finir); };
        addEventListener('mousemove', bouger); addEventListener('mouseup', finir);
      });
      placer(point, cle);
      return point;
    }));
  }

  function placer(point, cle) {
    point.style.left = `${reperes[cle][0] / image.width * 100}%`;
    point.style.top = `${reperes[cle][1] / image.height * 100}%`;
  }

  function rafraichir() {
    if (!image || !reperes) return;

    const blanc = mesurerBlanc(image, reperes.blanc);
    const gains = blanc && gainsDepuisBlanc(blanc);
    if (!gains) {
      journal.textContent = 'Le repère ✦ doit être posé sur la feuille blanche.';
      apercu.replaceChildren();
      resultats = null;
      return;
    }

    const controle = qualite(blanc, gains);
    const cases = extraire(image, [reperes.hg, reperes.hd, reperes.bd, reperes.bg],
      planche.colonnes, planche.rangees);

    resultats = cases.map((c, i) => ({
      feutre: planche.feutres[i],
      hex: c.brut ? enHex(corriger(c.brut, gains)) : null
    })).filter(x => x.feutre);

    tracerGrille(cases);

    apercu.replaceChildren(...resultats.map(({ feutre, hex }) =>
      h('div', { class: 'import__case' },
        h('span', { class: 'import__pastille', style: hex ? `background:${hex};color:${encreSur(hex)}` : '' },
          hex ? '' : '?'),
        h('span', { class: 'import__ref' }, feutre.reference),
        h('span', { class: 'import__nom' }, feutre.nom))));

    const echecs = controle.alertes.filter(a => a.gravite === 'echec');
    journal.textContent = echecs.length
      ? echecs[0].texte
      : [
          `Blanc lu : ${blanc.map(Math.round).join(', ')}.`,
          controle.alertes.length ? controle.alertes[0].texte : 'Vérifie que les couleurs correspondent aux noms, puis enregistre.'
        ].join(' ');
    enregistrer.disabled = echecs.length > 0;
  }

  function tracerGrille(cases) {
    for (const ancienne of calques.querySelectorAll('.mire')) ancienne.remove();
    const m = homographie([reperes.hg, reperes.hd, reperes.bd, reperes.bg]);
    if (!m) return;
    for (const c of cases) {
      const mire = h('span', { class: 'mire' });
      mire.style.left = `${c.centre[0] / image.width * 100}%`;
      mire.style.top = `${c.centre[1] / image.height * 100}%`;
      calques.append(mire);
    }
  }

  const enregistrer = h('button', {
    class: 'bouton bouton--primaire', disabled: true,
    onclick: async () => {
      enregistrer.disabled = true;
      let compte = 0;
      for (const { feutre, hex } of resultats) {
        if (!hex) continue;
        await majFeutre(feutre.id, { hex });
        compte++;
      }
      journal.textContent = `${compte} couleurs enregistrées sur la planche ${planche.planche}.`;
      naviguer('#/feutres');
    }
  }, 'Enregistrer les couleurs');

  const entete = h('header', { class: 'entete entete--sobre' },
    h('div', { class: 'entete__contenu' },
      h('a', { class: 'retour retour--sombre', href: '#/feutres' }, '‹ Mes feutres'),
      h('h1', { class: 'titre-album' }, 'Importer un nuancier'),
      h('p', { class: 'section__note' },
        'Photographie une planche du nuancier avec une feuille de papier blanc à côté, '
        + 'à plat et sans soleil direct. Place ensuite les quatre repères au centre des '
        + 'pastilles des coins, et le ✦ sur la feuille blanche.'),
      selecteur));

  const corps = h('div', { class: 'corps corps--import' },
    h('button', { class: 'bouton--pointille', onclick: () => entreePhoto.click() }, '＋ Photo de la planche'),
    entreePhoto,
    scene,
    journal,
    apercu);

  return {
    element: h('div', { class: 'vue' }, entete, corps, h('div', { class: 'actions' }, enregistrer))
  };
}
