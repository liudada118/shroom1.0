import { requireNativeModule } from 'expo';

/** Return the installed DriverKit-backed USB module; Expo Go does not contain it. */
export default requireNativeModule('ShroomUsbSerial');
