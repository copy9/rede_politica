# Rede Política

App de rede social com foco em política, no estilo Instagram/TikTok (feed de vídeos e fotos, perfis, curtidas e comentários).

## Tecnologias

- **Expo + React Native + TypeScript**: um código só para Android, iPhone e web
- **Expo Router**: navegação por arquivos (telas em `app/`)
- **Supabase**: login, banco de dados, armazenamento de fotos/vídeos e tempo real (cliente em `lib/supabase.ts`)
- **expo-video / expo-image / expo-image-picker**: tocar vídeos, mostrar imagens e escolher mídia da galeria/câmera

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
app/          telas (cada arquivo é uma rota)
components/   componentes reutilizáveis
constants/    cores e constantes
lib/          cliente do Supabase e utilitários
assets/       ícones, imagens e fontes
```
