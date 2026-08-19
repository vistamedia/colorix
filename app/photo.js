const COTE_MAX = 1600;
const QUALITE = 0.8;

/* V4 l'a confirmé sur l'appareil : Safari livre du JPEG et le canvas le relit.
   Aucun décodage à faire nous-mêmes. SPECS §8. */
export async function compresser(fichier) {
  const image = await createImageBitmap(fichier);
  const facteur = Math.min(1, COTE_MAX / Math.max(image.width, image.height));
  const largeur = Math.round(image.width * facteur);
  const hauteur = Math.round(image.height * facteur);

  const toile = new OffscreenCanvas(largeur, hauteur);
  toile.getContext('2d').drawImage(image, 0, 0, largeur, hauteur);
  image.close();

  return toile.convertToBlob({ type: 'image/jpeg', quality: QUALITE });
}

export async function versDonnees(blob) {
  const image = await createImageBitmap(blob);
  const toile = new OffscreenCanvas(image.width, image.height);
  const pinceau = toile.getContext('2d', { willReadFrequently: true });
  pinceau.drawImage(image, 0, 0);
  const donnees = pinceau.getImageData(0, 0, image.width, image.height);
  image.close();
  return donnees;
}
