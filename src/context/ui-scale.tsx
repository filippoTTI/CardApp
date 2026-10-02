import { createContext, useContext } from 'react';

import { Radius } from '@/constants/theme';

/** Scala applicata al contenuto (le schermate auth lo rimpiccioliscono per evitare lo scroll). */
export const UiScaleContext = createContext(1);

/** Raggi dei bordi compensati dalla scala, così appaiono identici su ogni schermata. */
export function useRadius() {
  const scale = useContext(UiScaleContext);
  return { md: Radius.md / scale, lg: Radius.lg / scale };
}
