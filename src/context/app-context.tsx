"use client";

import { createContext, useState, useMemo, type Dispatch, type SetStateAction, useEffect } from "react";
import { onAuthStateChanged, type User, signOut } from "firebase/auth";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { auth, db } from "@/lib/firebase";

export type Role = "owner" | "admin" | "loader" | "user";
export type AgeCalculationMethod = 'raceDay' | 'endOfYear';

interface AppContextType {
  role: Role;
  setRole: Dispatch<SetStateAction<Role>>;
  user: User | null;
  authLoading: boolean;
  logout: () => Promise<void>;
  raceDate: Date;
  setRaceDate: Dispatch<SetStateAction<Date>>;
  ageCalculationMethod: AgeCalculationMethod;
  setAgeCalculationMethod: Dispatch<SetStateAction<AgeCalculationMethod>>;
}

export const AppContext = createContext<AppContextType>({
  role: "user",
  setRole: () => {},
  user: null,
  authLoading: true,
  logout: async () => {},
  raceDate: new Date(),
  setRaceDate: () => {},
  ageCalculationMethod: 'raceDay',
  setAgeCalculationMethod: () => {},
});

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [role, setRole] = useState<Role>("user");
  const [user, setUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [raceDate, setRaceDate] = useState<Date>(new Date());
  const [ageCalculationMethod, setAgeCalculationMethod] = useState<AgeCalculationMethod>('raceDay');

  useEffect(() => {
    const fetchRole = async (uid: string): Promise<Role> => {
      const userRef = doc(db, "users", uid);
      const snapshot = await getDoc(userRef);
      if (snapshot.exists()) {
        const data = snapshot.data() as { role?: Role };
        return data.role ?? "user";
      }
      await setDoc(userRef, { role: "user" }, { merge: true });
      return "user";
    };

    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (currentUser) {
        setUser(currentUser);
        const userRole = await fetchRole(currentUser.uid);
        setRole(userRole);
      } else {
        setUser(null);
        setRole("user");
      }
      setAuthLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const logout = async () => {
    await signOut(auth);
    setRole("user");
  };

  const value = useMemo(
    () => ({ role, setRole, user, authLoading, logout, raceDate, setRaceDate, ageCalculationMethod, setAgeCalculationMethod }),
    [role, user, authLoading, raceDate, ageCalculationMethod]
  );

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}
