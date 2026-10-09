/**
 * Codice esercente contenuto in un QR (o in un link) dell'esercente: il QR generato da TSM è `cardapp://e/<codice>`;
 * si accetta anche un altro indirizzo che finisce con `/e/<codice>` oppure il solo codice. Null se non riconosciuto.
 */
export function parseEsercenteCode(data: string): string | null {
  const text = (data ?? '').trim();
  const link = text.match(/(?:^|\/)e\/([A-Za-z0-9]{3,32})\/?(?:[?#].*)?$/);
  if (link) return link[1].toUpperCase();
  return /^[A-Za-z0-9]{4,32}$/.test(text) ? text.toUpperCase() : null;
}
