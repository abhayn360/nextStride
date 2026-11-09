import type { CurrentUser, PublicProfile, UpdateProfileInput } from '@next-stride/shared';

import type { ApiClient } from './client';

export interface PickedImage {
  uri: string;
  mimeType?: string | null;
  fileName?: string | null;
}

export function createUsersApi(client: ApiClient) {
  return {
    me: () => client.request<CurrentUser>('/api/users/me'),
    updateMe: (input: UpdateProfileInput) =>
      client.request<CurrentUser>('/api/users/me', { method: 'PUT', body: input }),
    uploadAvatar: (image: PickedImage) => {
      const form = new FormData();
      const type = image.mimeType ?? 'image/jpeg';
      // React Native's FormData accepts a { uri, name, type } file descriptor.
      form.append('avatar', {
        uri: image.uri,
        name: image.fileName ?? `avatar.${type.split('/')[1] ?? 'jpg'}`,
        type,
      } as unknown as Blob);
      return client.request<CurrentUser>('/api/users/me/avatar', { method: 'POST', body: form });
    },
    removeAvatar: () => client.request<CurrentUser>('/api/users/me/avatar', { method: 'DELETE' }),
    byUsername: (username: string) =>
      client.request<PublicProfile>(`/api/users/${encodeURIComponent(username)}`),
  };
}

export type UsersApi = ReturnType<typeof createUsersApi>;
