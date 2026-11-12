import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { AccessOptions, DataResponse, RoleName, User } from "@/types/api";
import { api } from "./client";

export function useUsers() {
  return useQuery({
    queryKey: ["users"],
    queryFn: async () => (await api<DataResponse<User[]>>("/users")).data,
  });
}

export function useAccessOptions() {
  return useQuery({
    queryKey: ["users", "access-options"],
    queryFn: async () =>
      (await api<DataResponse<AccessOptions>>("/users/access-options")).data,
  });
}

export type ActivationInput = {
  userId: number;
  role: RoleName;
  grade_level_ids: number[];
  teacher_id: number | null;
};

export function useChangeUserStatus(userId: number) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (status: "active" | "inactive") =>
      api<DataResponse<User>>(`/users/${userId}/status`, { method: "PUT", body: { status } }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["users"] }),
  });
}

/** A temporary password for someone whose reset email did not arrive. */
export function useResetUserPassword(userId: number) {
  return useMutation({
    mutationFn: () => api<{ temporary_password: string; message: string }>(`/users/${userId}/reset-password`, { method: "POST" }),
  });
}

export function useDeleteUser(userId: number) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => api(`/users/${userId}`, { method: "DELETE" }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["users"] }),
  });
}

export function useActivateUser() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ userId, ...body }: ActivationInput) =>
      api<DataResponse<User>>(`/users/${userId}/activation`, {
        method: "PUT",
        body,
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["users"] }),
  });
}
