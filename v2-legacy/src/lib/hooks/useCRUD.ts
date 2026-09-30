import { useState, useCallback, useEffect, useRef } from "react";
import type Dexie from "dexie";

interface CRUDState<T> {
  items: T[];
  loading: boolean;
  error: Error | null;
}

export function useCRUD<T extends { id?: number }>(table: Dexie.Table<T, number>) {
  const [state, setState] = useState<CRUDState<T>>({
    items: [],
    loading: true,
    error: null,
  });

  const mountedRef = useRef(true);

  const refresh = useCallback(async () => {
    setState((prev) => ({ ...prev, loading: true, error: null }));
    try {
      const items = await table.toArray();
      if (mountedRef.current) {
        setState({ items, loading: false, error: null });
      }
    } catch (err) {
      if (mountedRef.current) {
        setState({ items: [], loading: false, error: err as Error });
      }
    }
  }, [table]);

  const add = useCallback(
    async (item: Omit<T, "id">) => {
      const id = await table.add(item as T);
      await refresh();
      return id;
    },
    [table, refresh]
  );

  const update = useCallback(
    async (id: number, changes: Partial<T>) => {
      await table.update(id, changes as any);
      await refresh();
    },
    [table, refresh]
  );

  const remove = useCallback(
    async (id: number) => {
      await table.delete(id);
      await refresh();
    },
    [table, refresh]
  );

  useEffect(() => {
    mountedRef.current = true;
    refresh();
    return () => {
      mountedRef.current = false;
    };
  }, [refresh]);

  return {
    ...state,
    add,
    update,
    remove,
    refresh,
  };
}
