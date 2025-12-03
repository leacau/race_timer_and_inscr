"use client";

import { createContext, useState, useMemo, useEffect, type Dispatch, type SetStateAction } from "react";
import type { Role } from "@/lib/types";
import type { EntryType } from "@/lib/auth-client";
import { fetchUserProfile, logoutUser, subscribeAuth } from "@/lib/auth-client";

export type AgeCalculationMethod = 'raceDay' | 'endOfYear';

type AuthUser = {
  uid: string | null;
  email: string;
  displayName?: string | null;
  role: Role;
  entryType: EntryType;
};

interface AppContextType {
  role: Role;
  setRole: Dispatch<SetStateAction<Role>>;
  user: AuthUser | null;
  entryType: EntryType | null;
  setEntryType: Dispatch<SetStateAction<EntryType | null>>;
  setUser: Dispatch<SetStateAction<AuthUser | null>>;
  authLoading: boolean;
  signOut: () => Promise<void>;
  raceDate: Date;
  setRaceDate: Dispatch<SetStateAction<Date>>;
  ageCalculationMethod: AgeCalculationMethod;
  setAgeCalculationMethod: Dispatch<SetStateAction<AgeCalculationMethod>>;
}

export const AppContext = createContext<AppContextType>({
  role: "unassigned",
  setRole: () => {},
  user: null,
  entryType: null,
  setEntryType: () => {},
  setUser: () => {},
  authLoading: true,
  signOut: async () => {},
  raceDate: new Date(),
  setRaceDate: () => {},
  ageCalculationMethod: 'raceDay',
  setAgeCalculationMethod: () => {},
});

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [role, setRole] = useState<Role>("unassigned");
  const [user, setUser] = useState<AuthUser | null>(null);
  const [entryType, setEntryType] = useState<EntryType | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [raceDate, setRaceDate] = useState<Date>(new Date());
  const [ageCalculationMethod, setAgeCalculationMethod] = useState<AgeCalculationMethod>('raceDay');

  useEffect(() => {
    const unsubscribe = subscribeAuth(async (firebaseUser) => {
      if (firebaseUser) {
        const profile = await fetchUserProfile(firebaseUser.uid);
        const resolvedRole = profile?.role ?? "unassigned";
        setRole(resolvedRole);
        setUser({
          uid: firebaseUser.uid,
          email: firebaseUser.email || "",
          displayName: firebaseUser.displayName,
          role: resolvedRole,
          entryType: "organization",
        });
        setEntryType("organization");
      } else {
        setUser(null);
        setRole(entryType === "visitor" ? "visitor" : "unassigned");
      }
      setAuthLoading(false);
    });
    return () => unsubscribe();
  }, [entryType]);

  useEffect(() => {
    if (entryType === "visitor" && user?.email) {
      setRole("visitor");
      setUser((prev) =>
        prev ? { ...prev, role: "visitor", entryType: "visitor" } : { uid: null, email: user.email, role: "visitor", entryType: "visitor" }
      );
    }
  }, [entryType, user?.email]);

  const signOut = async () => {
    await logoutUser();
    setUser(null);
    setRole("unassigned");
    setEntryType(null);
  };

  const value = useMemo(
    () => ({
      role,
      setRole,
      user,
      setUser,
      entryType,
      setEntryType,
      authLoading,
      signOut,
      raceDate,
      setRaceDate,
      ageCalculationMethod,
      setAgeCalculationMethod,
    }),
    [role, user, entryType, authLoading, raceDate, ageCalculationMethod]
  );

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}
