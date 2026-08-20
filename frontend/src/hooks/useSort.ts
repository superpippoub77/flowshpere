import { useMemo, useState } from "react";

export function useSort<T extends Record<string, any>>(items: T[], defaultKey?: keyof T) {
  const [orderBy, setOrderBy] = useState<keyof T | null>(defaultKey ?? null);
  const [orderDir, setOrderDir] = useState<"asc" | "desc">("asc");

  const sorted = useMemo(() => {
    if (!orderBy) return items;
    return [...items].sort((a, b) => {
      const av = a[orderBy];
      const bv = b[orderBy];
      if (av == null && bv == null) return 0;
      if (av == null) return 1;
      if (bv == null) return -1;
      if (typeof av === "number" && typeof bv === "number") {
        return orderDir === "asc" ? av - bv : bv - av;
      }
      const cmp = String(av).localeCompare(String(bv), undefined, { numeric: true, sensitivity: "base" });
      return orderDir === "asc" ? cmp : -cmp;
    });
  }, [items, orderBy, orderDir]);

  function requestSort(key: keyof T) {
    if (orderBy === key) {
      setOrderDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setOrderBy(key);
      setOrderDir("asc");
    }
  }

  return { sorted, orderBy, orderDir, requestSort };
}
