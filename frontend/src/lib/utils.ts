import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { API_BASE } from './env';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Ensures light mode is always used by removing the dark class from the document element.
 * This can be called from any component that needs to ensure light mode.
 */
export function ensureLightMode() {
  if (typeof document !== 'undefined') {
    // Always set dark mode to false
    document.documentElement.classList.toggle('dark', false);
  }
}

/**
 * Removes any dark mode classes from a className string
 * @param className The class string to process
 * @returns The class string with dark mode classes removed
 */
export function removeDarkClasses(className: string): string {
  return className
    .split(' ')
    .filter(cls => !cls.startsWith('dark:'))
    .join(' ');
}

export async function fetchRoutine(
  baumannType: string,
  season: string,
  timeOfDay: string,
  keywords: string[]
) {
  const query = new URLSearchParams({
    skin_type: baumannType,
    season,
    time: timeOfDay,
    keywords: keywords.join(','),
  });

  const res = await fetch(`${API_BASE}/routine/recommend?${query.toString()}`);
  if (!res.ok) {
    throw new Error('루틴 API 호출 실패');
  }
  return res.json();
}