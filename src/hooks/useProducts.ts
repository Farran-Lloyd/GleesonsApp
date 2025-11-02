import { useEffect, useState, useMemo } from "react";
import { supabase } from "../lib/supabase";

export type Product = {
  id: number;           // bigint comes to JS as number
  name: string;
  price: number;
  description: string | null;
  active: boolean;
  created_at: string;
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
      .select("*")
      .eq("active", true)
      .order("created_at", { ascending: false });

    if (error) setErrorMsg("Failed to load products.");
    else setProducts((data ?? []) as Product[]);
    setLoading(false);
  }

  useEffect(() => {
    fetchProducts();

    const channel = supabase
      .channel("products-rt")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "products" },
        (payload) => setProducts((prev) => [payload.new as Product, ...prev])
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "products" },
        (payload) =>
          setProducts((prev) =>
            prev.map((p) => (p.id === (payload.new as any).id ? (payload.new as Product) : p))
          )
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);

  const byId = useMemo(() => {
    const m = new Map<number, Product>();
    products.forEach((p) => m.set(p.id, p));
    return m;
  }, [products]);

  return { products, byId, loading, errorMsg, refresh: fetchProducts };
}
