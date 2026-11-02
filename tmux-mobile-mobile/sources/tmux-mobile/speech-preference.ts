import AsyncStorage from '@react-native-async-storage/async-storage';
import { createAsrPreference } from './asr-provider';
export const speechPreference = createAsrPreference(AsyncStorage);
