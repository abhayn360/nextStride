import type { CurrentUser, UpdateProfileInput } from '@next-stride/shared';
import { useMutation, useQuery } from '@tanstack/react-query';
import * as ImagePicker from 'expo-image-picker';

import { queryClient, queryKeys } from '@/lib/query-client';
import { usersApi } from '@/services';
import type { PickedImage } from '@/services/api/users.api';
import { useAuthStore } from '@/store/auth.store';

/** The auth store is the source of truth for the signed-in user; the query keeps it fresh. */
function storeUser(user: CurrentUser) {
  useAuthStore.getState().setUser(user);
  queryClient.setQueryData(queryKeys.me, user);
  return user;
}

export function useCurrentUser() {
  const user = useAuthStore((state) => state.user);
  const query = useQuery({
    queryKey: queryKeys.me,
    queryFn: async () => storeUser(await usersApi.me()),
    enabled: user !== null,
  });
  return { ...query, user };
}

export function useUpdateProfile() {
  return useMutation({
    mutationFn: (input: UpdateProfileInput) => usersApi.updateMe(input),
    onSuccess: storeUser,
  });
}

export function useUploadAvatar() {
  return useMutation({
    mutationFn: (image: PickedImage) => usersApi.uploadAvatar(image),
    onSuccess: storeUser,
  });
}

export function useRemoveAvatar() {
  return useMutation({ mutationFn: () => usersApi.removeAvatar(), onSuccess: storeUser });
}

/**
 * Opens the system photo picker with a square crop. Returns null if cancelled.
 * Picking images needs no library permission on modern iOS/Android.
 */
export async function pickAvatarImage(): Promise<PickedImage | null> {
  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    allowsEditing: true,
    aspect: [1, 1],
    quality: 0.8,
  });
  const asset = result.canceled ? undefined : result.assets[0];
  if (!asset) return null;
  return { uri: asset.uri, mimeType: asset.mimeType, fileName: asset.fileName };
}
