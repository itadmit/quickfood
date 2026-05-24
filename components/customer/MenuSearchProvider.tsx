"use client";

import { createContext, useContext, useState, type ReactNode } from "react";

interface MenuSearchValue {
  query: string;
  setQuery: (q: string) => void;
}

const MenuSearchContext = createContext<MenuSearchValue>({
  query: "",
  setQuery: () => {},
});

export function MenuSearchProvider({ children }: { children: ReactNode }) {
  const [query, setQuery] = useState("");
  return (
    <MenuSearchContext.Provider value={{ query, setQuery }}>
      {children}
    </MenuSearchContext.Provider>
  );
}

export function useMenuSearch() {
  return useContext(MenuSearchContext);
}
