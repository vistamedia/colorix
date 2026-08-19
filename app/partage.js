import { photosDe } from './donnees.js';

/* Légende pré-remplie, puis la feuille native : elle choisit l'app, elle écrit
   ce qu'elle veut, elle publie là-bas. L'app ne rapatrie rien. SPECS §10. */
function legende(planche, fiche, references) {
  const lignes = [];
  if (fiche) lignes.push(`${fiche.titre} — planche ${planche.numero}`);
  else lignes.push(`Planche ${planche.numero}`);
  if (planche.sujet_revele) lignes.push(planche.sujet_revele);
  if (references.length) lignes.push(references.join(' · '));
  return lignes.join('\n');
}

export async function partager(planche, fiche, feutresEmployes) {
  const photos = await photosDe(planche.id);
  const vignette = photos.find(p => p.vignette) || photos[0];

  const references = [...new Set(feutresEmployes.map(f => `${f.marque_nom} ${f.reference}`))].slice(0, 6);
  const texte = legende(planche, fiche, references);

  if (vignette?.blob) {
    const fichier = new File([vignette.blob], `planche-${planche.numero}.jpg`, { type: 'image/jpeg' });
    if (navigator.canShare?.({ files: [fichier] })) {
      return navigator.share({ files: [fichier], text: texte });
    }
  }
  return navigator.share({ text: texte });
}
