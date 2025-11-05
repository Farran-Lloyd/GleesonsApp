// src/hooks/useProducts.ts
import { useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabase";

export type Product = {
  id: number;                 // bigint -> number
  name: string;
  price: number;
  description: string | null;
  active: boolean;
  created_at: string;
  category: string | null;    // ⬅️ added
};

export function useProducts() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  async function fetchProducts() {
    setLoading(true);
    setErrorMsg(null);

    const { data, error } = await supabase
      .from("products")
      .select("id,name,price,description,active,created_at,category") // ⬅️ include category
      .eq("active", true)
      .order("created_at", { ascending: false });

    if (error) {
      setErrorMsg(`Failed to load products: ${error.message}`);
      setProducts([]);
    } else {
      setProducts((data ?? []) as Product[]);
    }
    setLoading(false);
  }

  useEffect(() => {
    fetchProducts();

    const channel = supabase
      .channel("products-rt")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "products" },
        (payload) => {
          const row = payload.new as Product;
          if (!row.active) return; // ignore inactive inserts
          setProducts((prev) => {
            // avoid dupes if we had it already
            if (prev.some((p) => p.id === row.id)) {
              return prev.map((p) => (p.id === row.id ? row : p));
            }
            return [row, ...prev];
          });
        }
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "products" },
        (payload) => {
          const row = payload.new as Product;
          setProducts((prev) => {
            // If product is now inactive, remove from list (since we filter active=true)
            if (!row.active) return prev.filter((p) => p.id !== row.id);
            return prev.map((p) => (p.id === row.id ? row : p));
          });
        }
      )
      .on(
        "postgres_changes",
        { event: "DELETE", schema: "public", table: "products" },
        (payload) => {
          const row = payload.old as Product;
          setProducts((prev) => prev.filter((p) => p.id !== row.id));
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  // Fast lookup by id
  const byId = useMemo(() => {
    const m = new Map<number, Product>();
    products.forEach((p) => m.set(p.id, p));
    return m;
  }, [products]);

  // Distinct categories (render "Uncategorized" for null/empty)
  const categories = useMemo(() => {
    const set = new Set<string>();
    for (const p of products) {
      set.add((p.category?.trim() || "Uncategorized"));
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [products]);

  // Grouped by category (keys use display label: "Uncategorized" for null/empty)
  const byCategory = useMemo(() => {
    const map = new Map<string, Product[]>();
    for (const p of products) {
      const key = p.category?.trim() || "Uncategorized";
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(p);
    }
    // sort each group by name for nicer UI
    for (const [, arr] of map) arr.sort((a, b) => a.name.localeCompare(b.name));
    return map;
  }, [products]);

  return {
    products,
    byId,
    byCategory,
    categories,
    loading,
    errorMsg,
    refresh: fetchProducts,
  };
}
