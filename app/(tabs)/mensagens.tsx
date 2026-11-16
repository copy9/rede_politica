// Botão de Mensagens do menu de baixo: abre a tela de Mensagens (o próprio botão faz a navegação).
import { Redirect } from 'expo-router';

export default function MessagesTab() {
  return <Redirect href="/messages" />;
}
