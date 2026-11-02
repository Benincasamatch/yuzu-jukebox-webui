import { useSyncExternalStore } from 'react';
import { currentSkin, subscribeSkin } from '../app/skin';

export function useSkin() {
  const skin = useSyncExternalStore(subscribeSkin, currentSkin);
  return { skin };
}
