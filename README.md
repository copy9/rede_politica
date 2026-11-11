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

### Configurações (todas funcionam dentro do app)

Ficam salvas no aparelho: o tema, o idioma e a economia de dados valem para o aparelho, e o resto vale para cada conta.
Senha (guardada como hash), dois fatores com código na tela, alertas de login, aparelhos conectados,
conta privada com pedidos para seguir, status de atividade, quem pode comentar, mandar mensagem,
mencionar ou desafiar, bloquear e silenciar, palavras ocultas, Melhores amigos nos stories,
notificações por tipo e pausa, tempo de uso real com limite diário e lembrete de pausa, baixar meus dados (JSON),
excluir conta, pedido de verificação, relatos de problema e idioma (tradução parcial para inglês e espanhol).
Sem servidor ainda: o código de dois fatores aparece na tela em vez de ir por SMS, e tudo fica só neste aparelho.

### Dados e LGPD

- **Estatísticas do público** (gênero, idade, cidades, bairros, temas, horários) são sempre **agregadas e anônimas**,
  a partir do que cada usuário declarou em *Editar perfil › Sobre você*.
- O **banco de apoiadores** só mostra quem tocou em **"Quero receber novidades"** no perfil do político e autorizou,
  com apenas os campos que escolheu. O cidadão cancela em *Configurações › Minhas autorizações*.

> **Banco de dados real (Supabase):** cada pessoa cria a própria conta em "Cadastre-se" e entra com
> **e-mail e senha**. Posts, fotos, curtidas, comentários, seguidores, mensagens, notificações,
> autorizações a políticos e batalhas ficam salvos no banco e aparecem para todo mundo.
> Batalhas (placar, chat, espectadores), mensagens e notificações chegam **em tempo real**.
> As regras de segurança estão em `supabase/migrations/` e são testadas por `node scripts/testar-banco.mjs`.
> No painel do político, visualizações, alcance e horários ainda são estimativas; o resto é real.

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
lib/          estado do app (ligado ao Supabase), configurações salvas, tema claro/escuro e cliente do Supabase
assets/       ícones, imagens e fontes
```
