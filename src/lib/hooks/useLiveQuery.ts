import { useState, useEffect, useRef, useCallback } from "react";

interface LiveQueryState<T> {
  data: T[];
  loading: boolean;
  error: Error | null;
}

export function useLiveQuery<T>(
  queryFn: () => Promise<T[]>,
  deps: unknown[]
) {
  const [state, setState] = useState<LiveQueryState<T>>({
    data: [],
    loading: true,
    error: null,
  });

  const mountedRef = useRef(true);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const execute = useCallback(async () => {
    setState((prev) => ({ ...prev, loading: true, error: null }));
    try {
      const result = await queryFn();
      if (mountedRef.current) {
        setState({ data: result, loading: false, error: null });
      }
    } catch (err) {
      if (mountedRef.current) {
        setState({ data: [], loading: false, error: err as Error });
      }
    }
  }, deps); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    mountedRef.current = true;
    execute();

    return () => {
      mountedRef.current = false;
      if (timerRef.current !== null) {
        clearTimeout(timerRef.current);
      }
    };
  }, [execute]);

  const refresh = useCallback(() => {
    execute();
  }, [execute]);

  return {
    ...state,
    refresh,
  };
}
