import { useEffect, useState } from "react";

export function useLoadingTimeout(
  loading: boolean,
  timeoutMs = 15000
) {
  const [timedOut, setTimedOut] = useState(false);

  useEffect(() => {
    if (!loading) {
      setTimedOut(false);
      return;
    }

    const timer = setTimeout(() => {
      setTimedOut(true);
    }, timeoutMs);

    return () => clearTimeout(timer);
  }, [loading, timeoutMs]);

  return timedOut;
}