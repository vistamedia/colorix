import { h, marqueCode } from '../rendu.js';
import { encreSur } from '../couleur.js';
import { REPERTOIRE } from '../symboles.js';

/* Nommer soi-même un symbole que le livre n'écrit qu'une fois.

   Le clavier iOS ne donne ni « Δ », ni « ◊ », ni « ψ » : sans clavier grec
   ajouté dans les réglages du téléphone, un champ de saisie seul serait
   inutilisable la moitié du temps. La palette offre donc d'un tap les seize
   signes que la reconnaissance sait déjà dessiner — ceux relevés dans le
   livre — et le champ reste là pour tout le reste. */

const SEGMENTEUR = new Intl.Segmenter('fr', { granularity: 'grapheme' });

/* Un caractère, un seul : ce code sert de clé dans le nuancier et de segment
   dans la route de l'écran d'attribution. */
function seulCaractere(texte) {
  const morceaux = [...SEGMENTEUR.segment(texte.trim())];
  return morceaux.length === 1 ? morceaux[0].segment : null;
}

/* `pris` sont les codes des autres cases de la planche. Deux entrées de même
   code rendraient la seconde inatteignable : `donnees.js` cherche par
   `find(e => e.code === code)`, et la route de l'attribution aussi. */
export function panneauSymbole({ hex, glyphe, code, rangCle, pris, surChoix }) {
  const couleur = hex || '#EFE6F4';
  const encre = encreSur(couleur);
  const refus = h('p', { class: 'panneau__note panneau__refus' });

  const choisir = (nouveau) => {
    panneau.remove();
    if (nouveau !== code) surChoix(nouveau);
  };

  const palette = h('div', { class: 'palette' }, REPERTOIRE.map(signe =>
    h('button', {
      class: `palette__signe${signe === code ? ' palette__signe--actuel' : ''}`,
      disabled: pris.has(signe),
      onclick: () => choisir(signe)
    }, signe)));

  const champ = h('input', {
    type: 'text', class: 'champ champ--symbole', maxlength: 4,
    autocapitalize: 'off', autocorrect: 'off', spellcheck: 'false',
    placeholder: '?', enterkeyhint: 'done'
  });

  const valider = () => {
    const signe = seulCaractere(champ.value);
    if (!signe) { refus.textContent = 'Un seul caractère, et pas vide.'; return; }
    if (pris.has(signe)) { refus.textContent = `« ${signe} » est déjà le code d’une autre case de cette planche.`; return; }
    choisir(signe);
  };
  champ.addEventListener('keydown', (e) => { if (e.key === 'Enter') valider(); });

  const panneau = h('div', { class: 'panneau' },
    h('div', { class: 'panneau__voile', onclick: () => panneau.remove() }),
    h('div', { class: 'panneau__feuille' },
      h('h2', { class: 'panneau__titre' }, 'Ce symbole'),
      /* Le découpage, toujours, et non le caractère en place : c'est lui qu'on
         compare à la bande du livre pour trancher. */
      h('div', { class: 'symbole__apercu' },
        h('span', {
          class: 'pastille pastille--grande',
          style: `background:${couleur};color:${encre}`
        }, marqueCode({ code: rangCle, glyphe }, encre))),
      h('p', { class: 'panneau__note' },
        'Le livre ne l’emploie que sur cette planche : l’app le découpe sur la '
        + 'photo faute de pouvoir le nommer. Si tu le reconnais, choisis-le ou '
        + 'tape-le — il prendra sa place partout.'),
      palette,
      h('div', { class: 'panneau__saisie' },
        champ,
        h('button', { class: 'bouton--secondaire', onclick: valider }, 'Utiliser')),
      refus,
      h('div', { class: 'panneau__actions' },
        code !== rangCle
          ? h('button', { class: 'bouton--secondaire', onclick: () => choisir(rangCle) }, 'Revenir à l’image')
          : null,
        h('button', { class: 'bouton bouton--primaire', onclick: () => panneau.remove() }, 'Fermer'))));

  document.body.append(panneau);
}
