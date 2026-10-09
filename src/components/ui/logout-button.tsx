import { LogOut } from 'lucide-react-native';
import { Alert } from 'react-native';

import { IconButton } from '@/components/ui/icon-button';
import { useAuth } from '@/context/auth';

/** Esce dall'account in uso (non dagli altri): icona "esci" moderna (Lucide), solo icona. */
export function LogoutButton() {
  const { user, leaveAccount } = useAuth();
  const where = user?.esercente ? ` presso ${user.esercente}` : '';
  const confirm = () =>
    Alert.alert("Esci dall'account", `Vuoi uscire dall'account ${user?.email ?? ''}${where}? Verrà rimosso da questo telefono; gli altri account restano.`, [
      { text: 'Annulla', style: 'cancel' },
      { text: 'Esci', style: 'destructive', onPress: () => void leaveAccount().catch((e) => Alert.alert('Esci', e instanceof Error ? e.message : 'Errore imprevisto')) },
    ]);
  return (
    <IconButton label="Esci" onPress={confirm}>
      {(color) => <LogOut size={22} color={color} strokeWidth={2.2} />}
    </IconButton>
  );
}
