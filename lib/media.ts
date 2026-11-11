// Economia de dados: pede imagens menores quando a opção está ligada.
// Hoje funciona com as imagens de exemplo (picsum); com o Supabase Storage, use as
// transformações de imagem dele (width/quality) no mesmo lugar.
export function mediaUri(uri: string | undefined, dataSaver: boolean): string | undefined {
  if (!uri || !dataSaver) return uri;
  const m = uri.match(/^(https:\/\/picsum\.photos\/seed\/[^/]+)\/(\d+)\/(\d+)$/);
  if (m) {
    const w = Math.round(Number(m[2]) / 2.5);
    const h = Math.round(Number(m[3]) / 2.5);
    return `${m[1]}/${w}/${h}`;
  }
  return uri;
}
