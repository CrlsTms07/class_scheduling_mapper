import { MutationCache, QueryCache, QueryClient } from "@tanstack/react-query";
import { ApiError } from "./client";

export const ME_QUERY_KEY = ["me"];

/** True when the API says the session has ended or the account was deactivated. */
export function isSessionLost(error: unknown): boolean {
  return (
    error instanceof ApiError &&
    (error.status === 401 ||
      (error.status === 403 && error.code === "account_not_active"))
  );
}

function handleError(error: unknown) {
  // Clearing the user makes the route guards send them back to the login page.
  if (isSessionLost(error)) {
    queryClient.setQueryData(ME_QUERY_KEY, null);
  }
}

export const queryClient = new QueryClient({
  queryCache: new QueryCache({ onError: handleError }),
  mutationCache: new MutationCache({ onError: handleError }),
  defaultOptions: {
    queries: { retry: false, refetchOnWindowFocus: false },
  },
});
