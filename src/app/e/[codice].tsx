import { Redirect, useLocalSearchParams } from 'expo-router';

import { useAuth } from '@/context/auth';

/** Link/QR dell'esercente (cardapp://e/<codice>): apre un nuovo login già collegato a quell'esercente, senza toccare gli account salvati. */
export default function EsercenteLink() {
  const { codice } = useLocalSearchParams<{ codice: string }>();
  const { isSignedIn } = useAuth();
  return <Redirect href={{ pathname: isSignedIn ? '/add-account' : '/login', params: { cod: codice } } as never} />;
}
