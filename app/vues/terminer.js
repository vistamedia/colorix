import { h } from '../rendu.js';
import { ajouterPhoto } from '../donnees.js';
import { compresser } from '../photo.js';

/* « Terminé » demande le sujet révélé, puis propose la photo. SPECS §5. */
export function panneauTerminer(courante, surValidation) {
  const champ = h('input', {
    type: 'text', class: 'champ', placeholder: 'ce que l’image révèle…',
    value: courante.sujet_revele || '', enterkeyhint: 'done'
  });

  const apercu = h('div', { class: 'apercu' });
  let blobRetenu = null;

  const entree = h('input', { type: 'file', accept: 'image/*', hidden: true });
  entree.addEventListener('change', async () => {
    const fichier = entree.files[0];
    if (!fichier) return;
    apercu.replaceChildren(h('span', { class: 'apercu__attente' }, 'Compression…'));
    blobRetenu = await compresser(fichier);
    const url = URL.createObjectURL(blobRetenu);
    apercu.replaceChildren(h('img', { src: url, alt: '', onload: () => URL.revokeObjectURL(url) }));
  });

  const valider = async () => {
    bouton.disabled = true;
    if (blobRetenu) await ajouterPhoto(courante.id, blobRetenu, 'resultat');
    panneau.remove();
    await surValidation(champ.value.trim());
  };

  const bouton = h('button', { class: 'bouton bouton--primaire', onclick: valider }, 'Enregistrer');

  const panneau = h('div', { class: 'panneau' },
    h('div', { class: 'panneau__voile', onclick: () => panneau.remove() }),
    h('div', { class: 'panneau__feuille' },
      h('h2', { class: 'panneau__titre' }, `Planche ${courante.numero} terminée`),
      h('p', { class: 'panneau__note' }, 'Qu’est-ce que le coloriage a révélé ?'),
      champ,
      h('button', { class: 'bouton--pointille bouton--pointille--court', onclick: () => entree.click() },
        '＋ Ajouter la photo du résultat'),
      apercu,
      entree,
      h('div', { class: 'panneau__actions' },
        h('button', { class: 'bouton--secondaire', onclick: () => panneau.remove() }, 'Plus tard'),
        bouton)));

  document.body.append(panneau);
  champ.focus();
}
