/**
 * OneDrive wurde am 21.10.2026 auf Nutzerwunsch aus der V2-Planung gestrichen
 * und wird seit dem 28.10.2026 nicht mehr angeboten. Die Anbindung bleibt im
 * Code, damit ein bereits verknüpftes Konto weiterhin sichtbar und trennbar
 * ist; neu verbinden lässt sich OneDrive in der Oberfläche nicht mehr.
 *
 * Hier auf `true` setzen, um das Angebot wieder einzuschalten.
 */
export const ONEDRIVE_OFFERED = false

/** OneDrive erscheint nur noch, solange ein Konto dieses Anbieters verknüpft ist. */
export function showOneDrive(connectedCount: number) {
  return ONEDRIVE_OFFERED || connectedCount > 0
}

/** Anbieter, die in der Oberfläche zur Auswahl stehen. */
export const cloudProviderLabel = ONEDRIVE_OFFERED
  ? 'Google Drive, OneDrive und MEGA'
  : 'Google Drive und MEGA'
