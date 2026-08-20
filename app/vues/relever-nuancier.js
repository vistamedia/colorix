import { h, ajouter, naviguer, marqueCode } from '../rendu.js';
import { encreSur } from '../couleur.js';
import { planche, contexteNuancier, releverPalette, cleDeRang } from '../donnees.js';
import { compresser, versDonnees } from '../photo.js';
import { extraire, mesurerBlanc, gainsDepuisBlanc, corriger, enHex, qualite, glypheDeCase, enDonnees } from '../nuancier-photo.js';
import { ecranReperes } from '../viseur.js';
import { reconnaitre } from '../symboles.js';
import { panneauSymbole } from './nommer-symbole.js';

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

  /* Une planche prend le début de la série, jamais un sous-ensemble à trous :
     celle de 17 nuances va de « 1 » à « h ». Il suffit donc de désigner le
     dernier code de la bande. Le compte doit être juste — sans quoi
     l'homographie étale N cases sur K rangées et décale tout le nuancier au
     lieu de l'écourter.
     La série s'arrête à « z ». Au-delà, le livre emploie des symboles qui
     changent d'identité et d'ordre d'une planche à l'autre : on en demande
     seulement le nombre, et on les découpe sur la photo. Leur clé est leur
     rang, la seule chose qui ne bouge pas. */
  let dernier = codes.length - 1;
  let symboles = 0;
  const listeRetenue = () => [
    ...codes.slice(0, dernier + 1),
    ...Array.from({ length: symboles }, (_, i) => cleDeRang(dernier + 1 + i))
  ];

  /* ---------- étape 1 : les codes de la bande, puis la photo ---------- */

  function etapeDepart() {
    const compte = h('p', { class: 'section__note section__note--compte' });
    const photo = h('button', { class: 'bouton--pointille' }, '＋ Photo de la page');

    const tous = codes.map((code, rang) => {
      const jeton = h('button', { class: 'jeton-code' }, code);
      jeton.addEventListener('click', () => { dernier = rang; majCompte(); });
      return jeton;
    });
    const jetons = h('div', { class: 'bande-codes' }, tous);

    /* Les symboles ne se nomment pas : on n'en demande que le nombre. */
    const combien = h('span', { class: 'compteur__valeur' });
    const moins = h('button', { class: 'compteur__pas', onclick: () => { symboles = Math.max(0, symboles - 1); majCompte(); } }, '−');
    const plus = h('button', { class: 'compteur__pas', onclick: () => { symboles += 1; majCompte(); } }, '＋');
    const suite = h('div', { class: 'compteur' },
      h('span', { class: 'compteur__libelle' },
        `Et après « ${codes[codes.length - 1]} », combien de cases à symbole ?`),
      h('span', { class: 'compteur__reglage' }, moins, combien, plus));

    const majCompte = () => {
      tous.forEach((jeton, rang) => {
        jeton.classList.toggle('jeton-code--absent', rang > dernier);
        jeton.classList.toggle('jeton-code--dernier', rang === dernier);
      });
      const total = dernier + 1 + symboles;
      compte.textContent = `${total} cases sur la bande, de « ${codes[0]} » à « ${codes[dernier]} »`
        + (symboles ? `, puis ${symboles} symbole${symboles > 1 ? 's' : ''}.` : '.');
      combien.textContent = symboles;
      moins.disabled = !symboles;
      suite.hidden = dernier < codes.length - 1;
      if (suite.hidden) symboles = 0;
    };
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
        'Tape le dernier code de la bande. S’il est suivi de cases à symbole, '
        + 'compte-les : l’app les découpera sur la photo, puisque le livre ne '
        + 'les emploie pas deux fois dans le même ordre. Le compte doit tomber '
        + 'juste, c’est lui qui découpe la photo.'),
      jetons,
      suite,
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

  async function etapeVerification() {
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

    corps.append(h('p', { class: 'section__note' }, 'Découpe des couleurs…'));
    vue.replaceChildren(entete('Résultat'), corps);

    /* Un symbole est d'abord reconnu ; à défaut il garde son découpage et sa
       clé de rang. « s » est l'une des lettres que l'éditeur écarte, la clé
       d'un symbole ne peut donc jamais heurter un code du livre. */
    const pris = new Set(codes);
    const releves = [];
    for (let i = 0; i < cases.length; i++) {
      if (!cases[i].brut) continue;
      const releve = { code: attendus[i], hex: enHex(corriger(cases[i].brut, gains)) };
      if (releve.code.startsWith('s')) {
        const decoupe = glypheDeCase(image, cases[i].cadre, cases[i].brut);
        /* Le découpage est gardé même sur une case reconnue ou nommée : c'est
           le code qui dit lequel des deux s'affiche, et se raviser plus tard ne
           doit pas imposer de refaire la photo. */
        releve.glyphe = decoupe && await enDonnees(decoupe);
        releve.rangCle = releve.code;
        releve.reconnu = reconnaitre(decoupe, pris);
        if (releve.reconnu) {
          releve.code = releve.reconnu;
          pris.add(releve.reconnu);
        }
      }
      releves.push(releve);
    }
    corps.replaceChildren();

    const reconnus = releves.filter(r => r.reconnu).length;
    const avertissement = controle.alertes.find(a => a.gravite === 'avertissement');

    ajouter(corps, [
      h('p', { class: 'section__note' },
        `${releves.length} couleurs relevées sur la page de la planche ${courante.numero}`
        + (reconnus ? `, dont ${reconnus} symbole${reconnus > 1 ? 's' : ''} reconnu${reconnus > 1 ? 's' : ''}` : '')
        + '. Compare chaque case à la bande du livre, code par code. Tape sur un '
        + 'symbole pour le nommer toi-même, ou pour lui rendre son image. Si tout est '
        + 'décalé d’un cran, c’est le compte de cases qui est faux : reviens le corriger.'),
      avertissement ? h('p', { class: 'alerte alerte--avertissement' }, avertissement.texte) : null,
      h('div', { class: 'import__apercu' }, releves.map(releve => {
        /* Une case à symbole s'ouvre d'un tap : c'est son œil qui tranche,
           jamais la ressemblance seule, et le livre n'écrit ce signe qu'ici. */
        const boite = h(releve.rangCle ? 'button' : 'div', { class: 'import__case' });
        const peindre = () => boite.replaceChildren(h('span', {
          class: 'import__pastille',
          style: `background:${releve.hex};color:${encreSur(releve.hex)}`
        }, marqueCode(releve, encreSur(releve.hex))));
        if (releve.rangCle) {
          boite.addEventListener('click', () => panneauSymbole({
            hex: releve.hex,
            glyphe: releve.glyphe,
            code: releve.code,
            rangCle: releve.rangCle,
            pris: new Set(releves.filter(r => r !== releve).map(r => r.code)),
            surChoix: (nouveau) => { releve.code = nouveau; peindre(); }
          }));
        }
        peindre();
        return boite;
      }))]);

    const enregistrer = h('button', {
      class: 'bouton bouton--primaire',
      onclick: async () => {
        enregistrer.disabled = true;
        enregistrer.textContent = 'Enregistrement…';
        await releverPalette(coloriageId, releves, contexte);
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
