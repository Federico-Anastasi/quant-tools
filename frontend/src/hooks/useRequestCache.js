import { useRef } from 'react';

/**
 * Hook to prevent duplicate in-flight requests
 * Returns a function that wraps axios requests with deduplication
 */
export function useRequestCache() {
  const inflightRequests = useRef(new Map());

  const cachedRequest = async (key, requestFn) => {
    // Check if request is already in flight
    if (inflightRequests.current.has(key)) {
      return inflightRequests.current.get(key);
    }

    // Create new request promise
    const promise = requestFn()
      .finally(() => {
        // Remove from in-flight when complete
        inflightRequests.current.delete(key);
      });

    // Store in-flight promise
    inflightRequests.current.set(key, promise);

    return promise;
  };

  return cachedRequest;
}
