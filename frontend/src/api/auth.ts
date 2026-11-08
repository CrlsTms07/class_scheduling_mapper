import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { DataResponse, MessageResponse, User } from "@/types/api";
import { api } from "./client";
import { isSessionLost, ME_QUERY_KEY } from "./queryClient";

/** The signed-in user, or null for a visitor. */
export function useMe() {
  return useQuery({
    queryKey: ME_QUERY_KEY,
    staleTime: 5 * 60 * 1000,
    queryFn: async (): Promise<User | null> => {
      try {
        return (await api<DataResponse<User>>("/me")).data;
      } catch (error) {
        if (isSessionLost(error)) {
          return null;
        }
        throw error;
      }
    },
  });
}

export function useLogin() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (credentials: { email: string; password: string }) =>
      api<DataResponse<User>>("/login", { method: "POST", body: credentials }),
    onSuccess: ({ data }) => queryClient.setQueryData(ME_QUERY_KEY, data),
  });
}

export function useLogout() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => api<MessageResponse>("/logout", { method: "POST" }),
    onSuccess: () => {
      // Setting the user to null tells the route guards to go to the login page.
      queryClient.setQueryData(ME_QUERY_KEY, null);

      // Nothing from this user's session should remain for the next user.
      queryClient.removeQueries({
        predicate: (query) => query.queryKey[0] !== ME_QUERY_KEY[0],
      });
    },
  });
}

export type SignUpInput = {
  first_name: string;
  middle_name?: string;
  last_name: string;
  suffix?: string;
  email: string;
  password: string;
  password_confirmation: string;
};

export function useSignUp() {
  return useMutation({
    mutationFn: (input: SignUpInput) =>
      api<MessageResponse>("/register", { method: "POST", body: input }),
  });
}

export function useForgotPassword() {
  return useMutation({
    mutationFn: (input: { email: string }) =>
      api<MessageResponse>("/forgot-password", { method: "POST", body: input }),
  });
}

export function useResetPassword() {
  return useMutation({
    mutationFn: (input: {
      token: string;
      email: string;
      password: string;
      password_confirmation: string;
    }) =>
      api<MessageResponse>("/reset-password", { method: "POST", body: input }),
  });
}

/** Subjects in color on the schedule. On unless the user turned it off. */
export function useColorCoding(): boolean {
  return useMe().data?.preferences?.color_coding ?? true;
}

export function useUpdatePreferences() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (body: { color_coding: boolean }) =>
      api<DataResponse<User>>("/me/preferences", { method: "PUT", body }),
    onSuccess: ({ data }) => queryClient.setQueryData(ME_QUERY_KEY, data),
  });
}
