// Textos de compartilhar com link: abre direto no app (se instalado) e link para baixar.
export const APP_DOWNLOAD = 'https://github.com/copy9/rede_politica/releases/latest/download/rede-politica.apk';
export const deepLink = (path: string) => `redepolitica://${path.replace(/^\//, '')}`;
export const shareText = (title: string, path: string) =>
  `${title}\n\nAbrir no app: ${deepLink(path)}\nBaixar a Rede Política: ${APP_DOWNLOAD}`;
