import { useCallback } from "react";
import { useSearchParams } from "react-router-dom";

/**
 * Un état d'écran (onglet, filtre) rangé dans l'URL : il survit à un
 * rechargement de la tablette et un lien partagé rouvre le même écran.
 * `replace` : changer de filtre n'empile pas d'entrées dans l'historique.
 */
export function useUrlState<T extends string>(key: string, fallback: T): [T, (v: T) => void] {
  const [params, setParams] = useSearchParams();
  const value = (params.get(key) as T | null) ?? fallback;
  const set = useCallback(
    (v: T) =>
      setParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          if (v === fallback || v === "") next.delete(key);
          else next.set(key, v);
          return next;
        },
        { replace: true },
      ),
    [key, fallback, setParams],
  );
  return [value, set];
}
