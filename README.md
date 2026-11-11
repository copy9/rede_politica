# Rede Política

App de rede social com foco em política, no estilo Instagram/TikTok (feed de vídeos e fotos, perfis, curtidas e comentários).

## Tecnologias

- **Expo + React Native + TypeScript**: um código só para Android, iPhone e web
- **Expo Router**: navegação por arquivos (telas em `app/`)
- **Supabase**: login, banco de dados, armazenamento de fotos/vídeos e tempo real (cliente em `lib/supabase.ts`)
- **expo-video / expo-image / expo-image-picker**: tocar vídeos, mostrar imagens e escolher mídia da galeria/câmera

## Telas prontas

Login e cadastro · Feed com stories · Explorar e busca · Nova publicação (galeria/câmera) ·
Vídeos em tela cheia · Meu perfil (publicações, vídeos, salvos) · Perfil de outra pessoa ·
Seguidores/seguindo · Publicação · Comentários · Curtidas · Notificações · Mensagens (lista e conversa) ·
Visualizador de stories · Editar perfil · Configurações ·
**Batalhas de lives** (lista, sala ao vivo com placar/apoios/chat, criar ou agendar batalha) ·
**Contas: cidadão e político** · **Painel do político** (início, desempenho, público, apoiadores) ·
**Modo escuro** · **Configurações completas** (aparência, notificações, privacidade, bloqueados e silenciados,
comentários e palavras ocultas, senha e segurança, informações pessoais, melhores amigos, salvos, sua atividade,
tempo de uso, idioma, verificação de conta, ajuda, sobre/termos)

### Dados e LGPD

- **Estatísticas do público** (gênero, idade, cidades, bairros, temas, horários) são sempre **agregadas e anônimas**,
  a partir do que cada usuário declarou em *Editar perfil › Sobre você*.
- O **banco de apoiadores** só mostra quem tocou em **"Quero receber novidades"** no perfil do político e autorizou,
  com apenas os campos que escolheu. O cidadão cancela em *Configurações › Minhas autorizações*.
- Login de demonstração como político: botão "Entrar como político (demonstração)" (conta `ana.ribeiro.ver`).

> **Modo demonstração:** por enquanto os dados são fictícios e ficam só na memória do app
> (`lib/mockData.ts` e `lib/store.tsx`). Entre com o botão "Entrar com a conta de demonstração"
> ou com o usuário `voce.demo` e qualquer senha. O próximo passo é ligar no Supabase.

## Como rodar no seu computador

Pré-requisitos: [Node.js LTS](https://nodejs.org) e [Git](https://git-scm.com). No celular, instale o app **Expo Go**.

```bash
git clone https://github.com/copy9/rede_politica.git
cd rede_politica
npm install
copy .env.example .env   # no Windows (no Mac/Linux: cp .env.example .env)
npx expo start
```

Abra o **Expo Go** no celular e escaneie o QR code que aparece no terminal (celular e PC na mesma rede Wi-Fi).
Para ver no navegador, aperte `w` no terminal.

## Atualização automática (Windows)

Dê dois cliques em **`iniciar.bat`**. Ele faz tudo sozinho:

- baixa as alterações do GitHub a cada 30 segundos;
- roda o `npm install` quando entra biblioteca nova;
- abre o app (janela do QR Code) e reinicia quando necessário.

Deixe a janela "sincronizando" aberta enquanto usa. (O `atualizar.bat` antigo só baixa as alterações.)

## Supabase

1. Crie uma conta e um projeto em https://supabase.com
2. Em *Project Settings > API*, copie a **Project URL** e a **anon public key**
3. Cole no arquivo `.env`

## Comandos úteis

| Comando | O que faz |
| --- | --- |
| `npx expo start` | inicia o app em modo desenvolvimento |
| `npx tsc --noEmit` | verifica erros de TypeScript |
| `npx expo lint` | verifica o estilo do código |
| `npx expo install <pacote>` | instala bibliotecas na versão compatível com o Expo |

## Estrutura

```
app/          telas (cada arquivo é uma rota; (tabs) = barra inferior; config/ = páginas de Configurações)
components/   componentes reutilizáveis
constants/    cores e constantes
lib/          estado do app, configurações salvas, dados de demonstração, tema claro/escuro e cliente do Supabase
assets/       ícones, imagens e fontes
```
