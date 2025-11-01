import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"
import { differenceInYears } from "date-fns";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function calculateAge(birthDate: string): number {
  if (!birthDate) return 0;
  try {
    return differenceInYears(new Date(), new Date(birthDate));
  } catch (error) {
    return 0;
  }
}

export function formatElapsedTime(ms: number): string {
  if (ms < 0) ms = 0;
  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const milliseconds = Math.floor((ms % 1000) / 10);

  return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}.${milliseconds.toString().padStart(2, '0')}`;
}
