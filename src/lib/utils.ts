import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"
import { differenceInYears, endOfYear } from "date-fns";
import type { AgeCalculationMethod } from "./types";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function calculateAge(birthDate: string | undefined | null, raceDate: Date = new Date(), method: AgeCalculationMethod = 'raceDay'): number | null {
  if (!birthDate) return null;
  try {
    const referenceDate = method === 'endOfYear' ? endOfYear(raceDate) : raceDate;
    
    const bd = new Date(birthDate);
    // Check for invalid date
    if (isNaN(bd.getTime())) return null;

    return differenceInYears(referenceDate, bd);
  } catch (error) {
    return null;
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

export function generateChipNumber(bibNumber: string): string {
  if (!bibNumber) return "";
  const paddedBib = String(bibNumber).padStart(5, '0');
  return `LT${paddedBib}`;
}

export function deriveBirthDateFromAge(age: number, referenceDate: Date = new Date()): string {
  const base = new Date(referenceDate);
  base.setHours(0, 0, 0, 0);
  base.setFullYear(base.getFullYear() - age);
  return base.toISOString().split('T')[0];
}
