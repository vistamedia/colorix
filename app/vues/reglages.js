import { h } from '../rendu.js';
import { exporter, importer, albumsPossedes, retirerAlbum } from '../donnees.js';
import { creerZip, lireZip } from '../zip.js';
import * as base from '../base.js';
import { miseEnPage, definirMiseEnPage, marquerExport, joursDepuisExport, dernierExport } from '../preferences.js';

const horodatage = () => new Date().toISOString().slice(0, 10);

async function construireArchive() {
  const contenu = await exporter();
  const entrees = [{
    nom: 'data.json',
    blob: new Blob([JSON.stringify(contenu, null, 1)], { type: 'application/json' })
  }];
  for (const photo of await base.lireTout('photos')) {
    if (photo.blob) entrees.push({ nom: `photos/${photo.id}.jpg`, blob: photo.blob });
  }
  return creerZip(entrees);
}

function telecharger(blob, nom) {
  const url = URL.createObjectURL(blob);
  const lien = h('a', { href: url, download: nom });
  document.body.append(lien);
  lien.click();
  lien.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}

function confirmer(titre, note, libelle, action) {
  const panneau = h('div', { class: 'panneau' },
    h('div', { class: 'panneau__voile', onclick: () => panneau.remove() }),
    h('div', { class: 'panneau__feuille' },
      h('h2', { class: 'panneau__titre' }, titre),
      h('p', { class: 'panneau__note' }, note),
      h('div', { class: 'panneau__actions' },
        h('button', { class: 'bouton--secondaire', onclick: () => panneau.remove() }, 'Annuler'),
        h('button', {
          class: 'bouton bouton--primaire',
          onclick: async () => { panneau.remove(); await action(); }
        }, libelle))));
  document.body.append(panneau);
}

export async function monter() {
  const albums = await albumsPossedes();
  const jours = joursDepuisExport();
  const estimation = await navigator.storage?.estimate?.();

  const journal = h('p', { class: 'section__note' });

  const boutonExport = h('button', {
    class: 'bouton bouton--primaire',
    onclick: async () => {
      boutonExport.disabled = true;
      journal.textContent = 'Construction de l’archive…';
      try {
        telecharger(await construireArchive(), `colorix-${horodatage()}.zip`);
        marquerExport();
        journal.textContent = 'Archive enregistrée. Range-la ailleurs que sur ce téléphone.';
      } catch (erreur) {
        journal.textContent = `Échec de l’export : ${erreur.message}`;
      }
      boutonExport.disabled = false;
    }
  }, 'Exporter tout');

  const entreeImport = h('input', { type: 'file', accept: '.zip,.json,application/zip,application/json', hidden: true });
  entreeImport.addEventListener('change', async () => {
    const fichier = entreeImport.files[0];
    if (!fichier) return;

    let contenu;
    let photos = new Map();
    try {
      if (fichier.name.endsWith('.json')) {
        contenu = JSON.parse(await fichier.text());
      } else {
        const fichiers = await lireZip(fichier);
        contenu = JSON.parse(new TextDecoder().decode(fichiers.get('data.json')));
        for (const [nom, octets] of fichiers) {
          if (nom.startsWith('photos/')) photos.set(nom.slice(7).replace(/\.jpg$/, ''), octets);
        }
      }
    } catch (erreur) {
      journal.textContent = `Fichier illisible : ${erreur.message}`;
      return;
    }

    const compte = (contenu.coloriages || []).length;
    confirmer('Restaurer cette sauvegarde ?',
      `L’archive contient ${compte} planche${compte > 1 ? 's' : ''} et ${photos.size} photo${photos.size > 1 ? 's' : ''}. `
      + 'Tout ce qui est sur cet appareil sera remplacé.',
      'Remplacer',
      async () => {
        journal.textContent = 'Restauration…';
        await importer(contenu, false);
        await base.vider(['photos']);
        for (const fiche of contenu.photos || []) {
          const octets = photos.get(fiche.id);
          if (octets) await base.ecrire('photos', { ...fiche, blob: new Blob([octets], { type: 'image/jpeg' }) });
        }
        journal.textContent = 'Restauration terminée.';
        location.hash = '#/albums';
        location.reload();
      });
  });

  const bascule = h('div', { class: 'bascule' },
    ...[['A', 'Ordre du livre'], ['B', 'Manquants en tête']].map(([cle, libelle]) =>
      h('button', {
        class: `filtre${miseEnPage() === cle ? ' filtre--actif' : ''}`,
        onclick: (e) => {
          definirMiseEnPage(cle);
          for (const b of bascule.children) b.classList.toggle('filtre--actif', b === e.target);
        }
      }, libelle)));

  const listeAlbums = h('div', { class: 'reglages__albums' },
    albums.length
      ? albums.map(a => h('div', { class: 'reglages__album' },
          h('span', { class: 'reglages__album-titre' }, a.titre),
          h('span', { class: 'carte-album__compte' }, `${a.faits} sur ${a.nb_coloriages}`),
          h('button', {
            class: 'reglages__retirer',
            onclick: () => confirmer('Retirer cet album ?',
              `Les ${a.nb_coloriages} planches de « ${a.titre} », leurs nuanciers et leurs photos seront effacés. `
              + 'Exporte avant si tu tiens à les garder.',
              'Retirer', async () => { await retirerAlbum(a.id); location.reload(); })
          }, 'Retirer')))
      : h('p', { class: 'section__note' }, 'Aucun album.'));

  const entete = h('header', { class: 'entete entete--sobre' },
    h('div', { class: 'entete__contenu' },
      h('h1', { class: 'titre-album' }, 'Réglages')));

  const corps = h('div', { class: 'corps corps--reglages' },
    jours !== null && jours >= 30
      ? h('p', { class: 'rappel' }, `Dernière sauvegarde il y a ${jours} jours.`)
      : null,

    h('h2', { class: 'section__titre' }, 'Sauvegarde'),
    h('p', { class: 'section__note' },
      'Une archive ZIP avec toutes tes données et toutes tes photos. '
      + (dernierExport()
        ? `Dernier export le ${new Date(dernierExport()).toLocaleDateString('fr-FR')}.`
        : 'Aucun export pour l’instant.')),
    boutonExport,
    h('button', { class: 'bouton--secondaire', onclick: () => entreeImport.click() }, 'Restaurer une sauvegarde'),
    entreeImport,
    journal,

    h('h2', { class: 'section__titre' }, 'Fiche coloriage'),
    h('p', { class: 'section__note' }, 'Deux mises en page, à choisir après essai sur l’appareil.'),
    bascule,

    h('h2', { class: 'section__titre' }, 'Albums'),
    listeAlbums,

    h('h2', { class: 'section__titre' }, 'Stockage'),
    h('p', { class: 'section__note' }, estimation
      ? `${(estimation.usage / 1048576).toFixed(1)} Mo utilisés sur ${(estimation.quota / 1073741824).toFixed(1)} Go disponibles.`
      : 'Estimation indisponible.'));

  return { element: h('div', { class: 'vue' }, entete, corps) };
}
