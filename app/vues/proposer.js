import { h, naviguer, marqueCode } from '../rendu.js';
import { encreSur, plusProches } from '../couleur.js';
import { planche, nuancier, contexteNuancier, feutres, marques, attribuerLot } from '../donnees.js';

/* Au-delà de cet écart, le plus proche n'est plus une proposition mais un
   pis-aller : la ligne s'affiche quand même, avec son chiffre, mais elle n'est
   pas retenue d'avance. SPECS §6.2 — jamais d'attribution silencieuse. */
const ECART_ACCEPTABLE = 25;

export async function monter(coloriageId) {
  const courante = await planche(coloriageId);
  if (!courante) return { element: h('div', { class: 'vue' }, h('p', { class: 'vide' }, 'Planche introuvable.')) };

  const [contexte, tous, listeMarques] = await Promise.all([
    contexteNuancier(courante.livre_id), feutres(), marques()
  ]);
  const n = await nuancier(coloriageId, contexte.jeu);
  const nomMarque = new Map(listeMarques.map(m => [m.id, m.nom]));
  const retour = `#/planche/${coloriageId}`;

  const entete = (titre) => h('header', { class: 'entete entete--sobre' },
    h('div', { class: 'entete__contenu' },
      h('a', { class: 'retour retour--sombre', href: retour }, `‹ Planche ${courante.numero}`),
      h('h1', { class: 'titre-album' }, titre)));

  const vide = (titre, texte) => ({
    element: h('div', { class: 'vue' }, entete('Proposer les feutres'),
      h('div', { class: 'corps corps--import' }, h('p', { class: 'vide' }, h('strong', {}, titre), texte)))
  });

  const disponibles = tous.filter(f => f.hex && f.etat !== 'non_possede');
  if (!disponibles.length) {
    return vide('Aucun feutre coloré',
      'Les propositions comparent la couleur du livre à celle de tes feutres. '
      + 'Relève d’abord une planche du nuancier depuis l’écran Feutres.');
  }

  /* On ne propose que pour ce qui est vide : une passe ne défait jamais un
     choix déjà fait, et un code sans couleur relevée n'a rien à comparer. */
  const propositions = n.entrees
    .filter(e => e.pastille_hex && !e.feutres.length)
    .map(entree => {
      const proche = plusProches(entree.pastille_hex, disponibles, 1)[0];
      if (!proche) return null;
      const ecart = Math.round(proche.ecart);
      return { entree, feutre: proche.feutre, ecart, retenu: ecart <= ECART_ACCEPTABLE };
    })
    .filter(Boolean);

  if (!propositions.length) {
    return vide('Rien à pourvoir',
      'Tous les codes dont la couleur est relevée ont déjà leur feutre. '
      + 'Pour en changer un, tape sa rangée sur la fiche.');
  }

  /* Dire dans quoi les propositions puisent : dix codes sans candidat proche,
     c'est presque toujours un nuancier de feutres à moitié relevé, pas une
     couleur du livre introuvable. Sans ce chiffre, l'écran laisse croire le
     contraire. */
  const possedes = tous.filter(f => f.etat !== 'non_possede').length;
  const auDela = propositions.filter(p => p.ecart > ECART_ACCEPTABLE).length;
  const couverture = h('p', { class: 'section__note' },
    `Comparé à ${disponibles.length} feutres dont la couleur est relevée, sur ${possedes} que tu possèdes.`
    + (auDela
      ? ` ${auDela} code${auDela > 1 ? 's n’ont' : ' n’a'} rien d’assez proche : relever d’autres `
        + 'planches du nuancier élargirait le choix.'
      : ''));
  const compte = h('p', { class: 'section__note section__note--compte' });
  const enregistrer = h('button', { class: 'bouton bouton--primaire' });

  const rafraichir = () => {
    const retenus = propositions.filter(p => p.retenu).length;
    compte.textContent = `${retenus} feutre${retenus > 1 ? 's' : ''} retenu${retenus > 1 ? 's' : ''} `
      + `sur ${propositions.length} code${propositions.length > 1 ? 's' : ''} à pourvoir.`;
    enregistrer.textContent = retenus ? `Attribuer ${retenus} feutres` : 'Aucun feutre retenu';
    enregistrer.disabled = !retenus;
  };

  const ligne = (proposition) => {
    const { entree, feutre, ecart } = proposition;
    const hex = entree.pastille_hex;
    const rangee = h('button', { class: 'proposition' },
      h('span', { class: 'proposition__couleurs' },
        h('span', {
          class: 'proposition__livre',
          style: `background:${hex};color:${encreSur(hex)}`
        }, marqueCode(entree, encreSur(hex))),
        h('span', { class: 'proposition__feutre', style: `background:${feutre.hex}` })),
      h('span', { class: 'proposition__texte' },
        h('span', { class: 'proposition__ref' }, feutre.reference),
        h('span', { class: 'proposition__nom' },
          `${nomMarque.get(feutre.marque_id) || ''} · ${feutre.nom}`)),
      h('span', { class: `proposition__ecart${ecart > ECART_ACCEPTABLE ? ' proposition__ecart--loin' : ''}` }, `ΔE ${ecart}`),
      h('span', { class: 'proposition__coche' }, proposition.retenu ? '✓' : ''));

    rangee.addEventListener('click', () => {
      proposition.retenu = !proposition.retenu;
      rangee.classList.toggle('proposition--ecartee', !proposition.retenu);
      rangee.lastElementChild.textContent = proposition.retenu ? '✓' : '';
      rafraichir();
    });
    rangee.classList.toggle('proposition--ecartee', !proposition.retenu);
    return rangee;
  };

  enregistrer.addEventListener('click', async () => {
    enregistrer.disabled = true;
    enregistrer.textContent = 'Attribution…';
    const parCode = Object.fromEntries(
      propositions.filter(p => p.retenu).map(p => [p.entree.code, [p.feutre.id]]));
    await attribuerLot(coloriageId, parCode, contexte);
    naviguer(retour);
  });

  rafraichir();

  return {
    element: h('div', { class: 'vue' },
      entete('Proposer les feutres'),
      h('div', { class: 'corps corps--propositions' },
        h('p', { class: 'section__note' },
          'Le feutre le plus proche de chaque couleur du livre, parmi ceux que tu '
          + 'possèdes et dont la couleur est relevée. Tape une rangée pour l’écarter. '
          + 'Au-delà de ΔE ' + ECART_ACCEPTABLE + ', rien n’est retenu d’avance.'),
        couverture,
        compte,
        ...propositions.map(ligne)),
      h('div', { class: 'actions' },
        h('button', { class: 'bouton bouton--chrono', onclick: () => naviguer(retour) }, 'Retour'),
        enregistrer))
  };
}
