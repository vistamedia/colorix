import { h, naviguer, marqueCode } from '../rendu.js';
import { encreSur, moyenneZone } from '../couleur.js';
import { planche, nuancier, pipetter, contexteNuancier } from '../donnees.js';
import { compresser, versDonnees } from '../photo.js';

const RAYON = 2;

export async function monter(coloriageId, code) {
  const courante = await planche(coloriageId);
  if (!courante) return { element: h('div', { class: 'vue' }, h('p', { class: 'vide' }, 'Planche introuvable.')) };

  const contexte = await contexteNuancier(courante.livre_id);
  const n = await nuancier(coloriageId, contexte.jeu);
  const entree = n.entrees.find(e => e.code === code);

  let donnees = null;
  let choisi = entree?.pastille_hex || null;
  let url = null;

  const toile = h('canvas', { class: 'pipette__toile' });
  const loupe = h('div', { class: 'loupe', hidden: true });
  const scene = h('div', { class: 'pipette__scene' }, toile, loupe);

  const temoin = h('span', {
    class: 'pipette__temoin',
    style: choisi ? `background:${choisi};color:${encreSur(choisi)}` : ''
  }, marqueCode(entree, encreSur(choisi || '#EFE6F4')));
  const valeur = h('span', { class: 'pipette__valeur' }, choisi || 'tape sur la couleur');

  const valider = h('button', {
    class: 'bouton bouton--primaire',
    disabled: !choisi,
    onclick: async () => {
      await pipetter(coloriageId, code, choisi, contexte);
      naviguer(`#/planche/${coloriageId}/code/${encodeURIComponent(code)}`);
    }
  }, 'Retenir cette couleur');

  const relever = (evenement) => {
    if (!donnees) return;
    const cadre = toile.getBoundingClientRect();
    const point = evenement.touches?.[0] || evenement;
    const x = Math.round((point.clientX - cadre.left) / cadre.width * toile.width);
    const y = Math.round((point.clientY - cadre.top) / cadre.height * toile.height);
    if (x < 0 || y < 0 || x >= toile.width || y >= toile.height) return;

    choisi = moyenneZone(donnees.data, toile.width, x, y, RAYON);
    temoin.style.background = choisi;
    temoin.style.color = encreSur(choisi);
    valeur.textContent = choisi;
    valider.disabled = false;

    loupe.hidden = false;
    loupe.style.left = `${point.clientX - cadre.left}px`;
    loupe.style.top = `${point.clientY - cadre.top}px`;
    loupe.style.background = choisi;
  };

  scene.addEventListener('touchstart', relever, { passive: true });
  scene.addEventListener('touchmove', relever, { passive: true });
  scene.addEventListener('click', relever);

  const entree_fichier = h('input', { type: 'file', accept: 'image/*', hidden: true });
  entree_fichier.addEventListener('change', async () => {
    const fichier = entree_fichier.files[0];
    if (!fichier) return;
    const blob = await compresser(fichier);
    donnees = await versDonnees(blob);
    toile.width = donnees.width;
    toile.height = donnees.height;
    toile.getContext('2d').putImageData(donnees, 0, 0);
    if (url) URL.revokeObjectURL(url);
    scene.classList.add('pipette__scene--chargee');
    consigne.textContent = 'Tape sur la pastille du code dans la légende.';
  });

  const consigne = h('p', { class: 'section__note' },
    'Photographie la bande de légende de la planche, puis tape sur la pastille du code.');

  const entete = h('header', { class: 'entete entete--sobre' },
    h('div', { class: 'entete__contenu' },
      h('a', { class: 'retour retour--sombre', href: `#/planche/${coloriageId}/code/${encodeURIComponent(code)}` },
        `‹ Code ${code}`),
      h('h1', { class: 'titre-code' }, 'Scanner la couleur'),
      consigne));

  const corps = h('div', { class: 'corps corps--pipette' },
    h('button', { class: 'bouton--pointille', onclick: () => entree_fichier.click() },
      '＋ Photo de la légende'),
    entree_fichier,
    scene,
    h('div', { class: 'pipette__resultat' }, temoin, valeur));

  const actions = h('div', { class: 'actions' }, valider);

  return {
    element: h('div', { class: 'vue' }, entete, corps, actions),
    demonter: () => { if (url) URL.revokeObjectURL(url); }
  };
}
