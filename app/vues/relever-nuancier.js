import { h, naviguer } from '../rendu.js';
import { encreSur } from '../couleur.js';
import { planche, contexteNuancier, releverPastilles } from '../donnees.js';
import { compresser, versDonnees } from '../photo.js';
import { extraire, mesurerBlanc, gainsDepuisBlanc, corriger, enHex, qualite } from '../nuancier-photo.js';
import { ecranReperes } from '../viseur.js';

/* La bande du livre n'a qu'une colonne : ses coins se visent bien mieux que le
   centre d'une case, d'où la convention « bords ». */
const ETAPES = [
  { cle: 'hg', titre: 'Coin haut-gauche de la bande', aide: 'Le coin supérieur gauche de la toute première case de couleur, celle du code du haut.' },
  { cle: 'hd', titre: 'Coin haut-droit de la bande', aide: 'Le coin supérieur droit de cette même première case.' },
  { cle: 'bd', titre: 'Coin bas-droit de la bande', aide: 'Le coin inférieur droit de la toute dernière case, tout en bas.' },
  { cle: 'bg', titre: 'Coin bas-gauche de la bande', aide: 'Le coin inférieur gauche de cette même dernière case.' },
  { cle: 'blanc', titre: 'Le blanc de la page', aide: 'Pose le repère sur le papier blanc, à côté de la bande. Pas de feuille à ajouter ici : la page est déjà blanche.' }
];

export async function monter(coloriageId) {
  const courante = await planche(coloriageId);
  if (!courante) return { element: h('div', { class: 'vue' }, h('p', { class: 'vide' }, 'Planche introuvable.')) };

  const contexte = await contexteNuancier(courante.livre_id);
  const codes = contexte.jeu;
  const retour = `#/planche/${coloriageId}`;
  const entete = (titre) => h('header', { class: 'entete entete--sobre' },
    h('div', { class: 'entete__contenu' },
      h('a', { class: 'retour retour--sombre', href: retour }, `‹ Planche ${courante.numero}`),
      h('h1', { class: 'titre-album' }, titre)));

  if (!codes.length) {
    return { element: h('div', { class: 'vue' },
      entete('Relever le nuancier'),
      h('div', { class: 'corps corps--import' },
        h('p', { class: 'vide' },
          h('strong', {}, 'Aucun code'),
          'Ce livre n’a pas encore de jeu de codes : il n’y a rien à relever.'))) };
  }

  const vue = h('div', { class: 'vue' });
  const reperes = {};
  let image = null;

  /* Une planche n'emploie pas forcément toutes les couleurs du livre : sa bande
     ne compte que les siennes. Le nombre de cases doit donc venir de la page,
     pas du jeu de codes — sans quoi l'homographie étale N cases sur K rangées
     et décale tout le nuancier. Elle décoche les codes absents, l'ordre du
     livre fait le reste. */
  const retenus = new Set(codes);
  const listeRetenue = () => codes.filter(code => retenus.has(code));

  /* ---------- étape 1 : les codes de la bande, puis la photo ---------- */

  function etapeDepart() {
    const compte = h('p', { class: 'section__note section__note--compte' });
    const photo = h('button', { class: 'bouton--pointille' }, '＋ Photo de la page');
    const majCompte = () => {
      compte.textContent = `${retenus.size} case${retenus.size > 1 ? 's' : ''} sur la bande.`;
      photo.disabled = !retenus.size;
    };

    const jetons = h('div', { class: 'bande-codes' }, codes.map(code => {
      const jeton = h('button', { class: 'jeton-code' }, code);
      jeton.addEventListener('click', () => {
        retenus.has(code) ? retenus.delete(code) : retenus.add(code);
        jeton.classList.toggle('jeton-code--absent', !retenus.has(code));
        majCompte();
      });
      jeton.classList.toggle('jeton-code--absent', !retenus.has(code));
      return jeton;
    }));
    majCompte();

    const entree = h('input', { type: 'file', accept: 'image/*', hidden: true });
    entree.addEventListener('change', async () => {
      const fichier = entree.files[0];
      if (!fichier) return;
      corps.replaceChildren(h('p', { class: 'section__note' }, 'Lecture de la photo…'));
      image = await versDonnees(await compresser(fichier));
      etapeReperes(0);
    });
    photo.addEventListener('click', () => entree.click());

    const corps = h('div', { class: 'corps corps--import' },
      h('h2', { class: 'section__titre' }, `La page « Mon nuancier #${courante.numero} »`),
      h('p', { class: 'section__note' },
        'Compare la bande de la page à cette liste et décoche les codes qui n’y '
        + 'sont pas. Le compte doit tomber juste : c’est lui qui découpe la photo.'),
      jetons,
      compte,
      h('p', { class: 'section__note' },
        'Photographie ensuite la page bien à plat, la bande entière dans le cadre, '
        + 'sans soleil direct ni flash. Le blanc de la page sert de référence : '
        + 'c’est lui qui rend les couleurs justes.'),
      photo,
      entree);

    vue.replaceChildren(entete('Relever le nuancier'), corps);
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
      corps.append(
        h('p', { class: 'alerte alerte--echec' }, !gains
          ? 'Le repère du blanc est mal posé.'
          : controle.alertes.find(a => a.gravite === 'echec').texte),
        h('button', { class: 'bouton--secondaire', onclick: () => etapeReperes(4) }, 'Replacer le repère blanc'),
        h('button', { class: 'bouton--secondaire', onclick: () => etapeDepart() }, 'Reprendre la photo'));
      vue.replaceChildren(entete('Résultat'), corps);
      return;
    }

    const attendus = listeRetenue();
    const cases = extraire(image, [reperes.hg, reperes.hd, reperes.bd, reperes.bg], 1, attendus.length, 'bords');
    const releves = cases
      .map((c, i) => ({ code: attendus[i], hex: c.brut ? enHex(corriger(c.brut, gains)) : null }))
      .filter(x => x.hex);

    const avertissement = controle.alertes.find(a => a.gravite === 'avertissement');

    corps.append(
      h('p', { class: 'section__note' },
        `${releves.length} couleurs relevées sur la page de la planche ${courante.numero}. `
        + 'Compare chaque case à la bande du livre, code par code. Si tout est décalé '
        + 'd’un cran, c’est le compte de cases qui est faux : reviens le corriger.'),
      avertissement ? h('p', { class: 'alerte alerte--avertissement' }, avertissement.texte) : null,
      h('div', { class: 'import__apercu' }, releves.map(({ code, hex }) =>
        h('div', { class: 'import__case' },
          h('span', {
            class: 'import__pastille',
            style: `background:${hex};color:${encreSur(hex)}`
          }, code)))));

    const enregistrer = h('button', {
      class: 'bouton bouton--primaire',
      onclick: async () => {
        enregistrer.disabled = true;
        enregistrer.textContent = 'Enregistrement…';
        await releverPastilles(coloriageId, Object.fromEntries(releves.map(r => [r.code, r.hex])), contexte);
        naviguer(retour);
      }
    }, `Enregistrer ${releves.length} couleurs`);

    vue.replaceChildren(
      entete('Résultat'),
      corps,
      h('div', { class: 'actions actions--colonne' },
        h('button', { class: 'bouton--secondaire', onclick: () => etapeDepart() }, 'Corriger le compte de cases'),
        h('div', { class: 'actions__ligne' },
          h('button', { class: 'bouton bouton--chrono', onclick: () => etapeReperes(0) }, 'Repères'),
          enregistrer)));
  }

  etapeDepart();
  return { element: vue };
}
