import { LogOut } from 'lucide-react-native';
import { Alert } from 'react-native';

import { IconButton } from '@/components/ui/icon-button';
import { useAuth } from '@/context/auth';

/** Logout: icona "esci" moderna (Lucide), solo icona. */
export function LogoutButton() {
  const { signOut } = useAuth();
  const confirm = () =>
    Alert.alert('Esci dall\'account', 'Vuoi davvero uscire?', [
      { text: 'Annulla', style: 'cancel' },
      { text: 'Esci', style: 'destructive', onPress: signOut },
    ]);
  return (
    <IconButton label="Esci" onPress={confirm}>
      {(color) => <LogOut size={22} color={color} strokeWidth={2.2} />}
    </IconButton>
  );
}
