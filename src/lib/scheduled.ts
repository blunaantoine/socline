/**
 * Formatage des rendez-vous planifiés (réservations « Plus tard »).
 * Une seule source pour les badges laveur, les bandeaux client, les
 * notifications et l'historique — cohérence de langue et de format garantie.
 */
import { format, isToday, isTomorrow } from 'date-fns';
import { fr } from 'date-fns/locale';

export type ScheduledDate = string | Date | null | undefined;

function toDate(value: ScheduledDate): Date | null {
  if (!value) return null;
  const d = value instanceof Date ? value : new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

/**
 * Libellé court pour badges et listes : « sam. 14 juin · 10:00 »,
 * « aujourd'hui · 10:00 », « demain · 10:00 ». Retourne null si la date
 * est absente ou invalide (les appelants affichent alors rien du tout).
 */
export function formatScheduledShort(value: ScheduledDate): string | null {
  const d = toDate(value);
  if (!d) return null;
  const time = format(d, 'HH:mm');
  if (isToday(d)) return `aujourd'hui · ${time}`;
  if (isTomorrow(d)) return `demain · ${time}`;
  return `${format(d, 'EEE d MMM', { locale: fr })} · ${time}`;
}

/**
 * Libellé complet pour bandeaux et notifications : « samedi 14 juin à 10:00 »,
 * « aujourd'hui à 10:00 », « demain à 10:00 ». Retourne null si invalide.
 */
export function formatScheduledLong(value: ScheduledDate): string | null {
  const d = toDate(value);
  if (!d) return null;
  const time = format(d, 'HH:mm');
  if (isToday(d)) return `aujourd'hui à ${time}`;
  if (isTomorrow(d)) return `demain à ${time}`;
  return `${format(d, "EEEE d MMMM 'à' HH:mm", { locale: fr })}`;
}
