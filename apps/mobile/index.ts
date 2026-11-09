// Background tasks must be registered before the app renders (and when the OS
// starts the app headlessly to deliver locations), so they load first.
import './src/services/location/location-task';
import 'expo-router/entry';
