import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

export interface TokenStorage {
  getRefreshToken(): Promise<string | null>;
  setRefreshToken(token: string): Promise<void>;
  clear(): Promise<void>;
}

const REFRESH_TOKEN_KEY = 'next-stride.refresh-token';

/**
 * Refresh tokens are kept in the iOS Keychain / Android Keystore via SecureStore,
 * readable only after first unlock and never synced to other devices or backups.
 */
const secureStoreOptions: SecureStore.SecureStoreOptions = {
  keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY,
};

const nativeTokenStorage: TokenStorage = {
  getRefreshToken: () => SecureStore.getItemAsync(REFRESH_TOKEN_KEY, secureStoreOptions),
  setRefreshToken: (token) => SecureStore.setItemAsync(REFRESH_TOKEN_KEY, token, secureStoreOptions),
  clear: () => SecureStore.deleteItemAsync(REFRESH_TOKEN_KEY, secureStoreOptions),
};

/** SecureStore has no web implementation. Web is a development target only. */
const webTokenStorage: TokenStorage = {
  getRefreshToken: () => AsyncStorage.getItem(REFRESH_TOKEN_KEY),
  setRefreshToken: (token) => AsyncStorage.setItem(REFRESH_TOKEN_KEY, token),
  clear: () => AsyncStorage.removeItem(REFRESH_TOKEN_KEY),
};

export const tokenStorage: TokenStorage = Platform.OS === 'web' ? webTokenStorage : nativeTokenStorage;
