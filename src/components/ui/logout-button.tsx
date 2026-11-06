import { LogOut } from 'lucide-react-native';
import { Alert } from 'react-native';

import { IconButton } from '@/components/ui/icon-button';
import { useAuth } from '@/context/auth';

/** Esce dall'account in uso senza dimenticarlo: resta salvato sul telefono e si riapre dal login con Face ID / impronta. */
export function LogoutButton() {
  const { user, signOut } = useAuth();
  const where = user?.esercente ? ` presso ${user.esercente}` : '';
  const confirm = () =>
    Alert.alert("Esci dall'account", `Vuoi uscire dall'account ${user?.email ?? ''}${where}? Resta salvato su questo telefono: dal login potrai rientrare con Face ID o impronta.`, [
      { text: 'Annulla', style: 'cancel' },
      { text: 'Esci', style: 'destructive', onPress: signOut },
    ]);
  return (
    <IconButton label="Esci" onPress={confirm}>
      {(color) => <LogOut size={22} color={color} strokeWidth={2.2} />}
    </IconButton>
  );
}
