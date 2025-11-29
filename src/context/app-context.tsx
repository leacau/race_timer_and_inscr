"use client";

import { createContext, useState, useMemo, type Dispatch, type SetStateAction } from "react";

export type Role = "admin" | "viewer";
export type AgeCalculationMethod = 'raceDay' | 'endOfYear';

interface AppContextType {
  role: Role;
  setRole: Dispatch<SetStateAction<Role>>;
  raceDate: Date;
  setRaceDate: Dispatch<SetStateAction<Date>>;
  ageCalculationMethod: AgeCalculationMethod;
  setAgeCalculationMethod: Dispatch<SetStateAction<AgeCalculationMethod>>;
}

export const AppContext = createContext<AppContextType>({
  role: "viewer",
  setRole: () => {},
  raceDate: new Date(),
  setRaceDate: () => {},
  ageCalculationMethod: 'raceDay',
  setAgeCalculationMethod: () => {},
});

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [role, setRole] = useState<Role>("viewer");
  const [raceDate, setRaceDate] = useState<Date>(new Date());
  const [ageCalculationMethod, setAgeCalculationMethod] = useState<AgeCalculationMethod>('raceDay');

  const value = useMemo(() => ({ role, setRole, raceDate, setRaceDate, ageCalculationMethod, setAgeCalculationMethod }), [role, raceDate, ageCalculationMethod]);

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}
