"use client";

import { createContext, useState, useMemo, type Dispatch, type SetStateAction } from "react";

export type Role = "admin" | "viewer";

interface AppContextType {
  role: Role;
  setRole: Dispatch<SetStateAction<Role>>;
}

export const AppContext = createContext<AppContextType>({
  role: "viewer",
  setRole: () => {},
});

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [role, setRole] = useState<Role>("admin"); // Default to admin for demonstration
  const value = useMemo(() => ({ role, setRole }), [role]);

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}
