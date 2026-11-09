import { useState } from 'react';
import { View } from 'react-native';

import { Avatar, BottomSheet, Button, Text } from '@/components/ui';
import { pickAvatarImage, useRemoveAvatar, useUploadAvatar } from '@/hooks/use-profile';
import { isApiError } from '@/services';
import { useThemedStyles } from '@/theme';

/** Avatar with change/remove actions. Uploads immediately on pick. */
export function AvatarPicker({ name, uri, size = 96 }: { name: string; uri: string | null; size?: number }) {
  const [sheetOpen, setSheetOpen] = useState(false);
  const upload = useUploadAvatar();
  const remove = useRemoveAvatar();
  const styles = useThemedStyles((t) => ({
    root: { alignItems: 'center', gap: t.spacing.xs },
    actions: { gap: t.spacing.xs },
  }));

  const choose = async () => {
    setSheetOpen(false);
    const image = await pickAvatarImage();
    if (image) upload.mutate(image);
  };

  const error = upload.error ?? remove.error;
  const busy = upload.isPending || remove.isPending;

  return (
    <View style={styles.root}>
      <Avatar
        name={name}
        uri={uri}
        size={size}
        loading={busy}
        onPress={() => (uri ? setSheetOpen(true) : void choose())}
      />
      <Text variant="caption" tone={error ? 'error' : 'secondary'}>
        {error ? (isApiError(error) ? error.message : 'Could not update photo') : uri ? 'Tap to change photo' : 'Add a profile photo'}
      </Text>

      <BottomSheet visible={sheetOpen} onClose={() => setSheetOpen(false)} title="Profile photo">
        <View style={styles.actions}>
          <Button label="Choose a new photo" leftIcon="image" onPress={() => void choose()} />
          <Button
            label="Remove photo"
            variant="danger"
            leftIcon="trash-2"
            onPress={() => {
              setSheetOpen(false);
              remove.mutate();
            }}
          />
          <Button label="Cancel" variant="text" onPress={() => setSheetOpen(false)} />
        </View>
      </BottomSheet>
    </View>
  );
}
