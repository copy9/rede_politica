// Textos de Termos de uso e Política de Privacidade.
// Antes de publicar nas lojas: preencha os dados da empresa em LEGAL_CONTACT e peça para um advogado revisar.
// As mesmas regras estão nas páginas públicas docs/privacidade.html e docs/excluir-conta.html (gere com scripts/legal-pages.mjs).

export const LEGAL_CONTACT = {
  company: '[RAZÃO SOCIAL DA EMPRESA]',
  cnpj: '[CNPJ]',
  address: '[ENDEREÇO COMPLETO]',
  email: '[E-MAIL DE PRIVACIDADE]',
  dpo: '[NOME DO ENCARREGADO DE DADOS]',
  updatedAt: '25 de novembro de 2026',
};

export const TERMS: [string, string][] = [
  ['Idade mínima', 'O Polarizei é só para maiores de 18 anos. Ao criar a conta, você confirma que tem 18 anos ou mais.'],
  ['Respeito', 'Debata ideias, não ataque pessoas. Ameaças, discurso de ódio e assédio levam à suspensão da conta.'],
  ['Informação verdadeira', 'Não publique conteúdo falso sobre eleições, candidatos ou o processo de votação. Conteúdos denunciados podem ser removidos.'],
  ['Contas políticas', 'Devem representar a pessoa real. Propaganda eleitoral segue as regras e os prazos da Justiça Eleitoral.'],
  [
    'Dados de apoiadores',
    'Políticos só podem usar os contatos de quem os autorizou, e só para enviar notícias, convites e comunicados do mandato ou da campanha. É proibido vender, ceder ou repassar esses dados a terceiros.',
  ],
  ['Excluir a conta', 'Você pode excluir sua conta a qualquer momento em Configurações › Excluir minha conta. A exclusão é definitiva.'],
];

const c = LEGAL_CONTACT;

export const PRIVACY: [string, string][] = [
  [
    'Quem cuida dos seus dados',
    `O Polarizei é operado por ${c.company}, CNPJ ${c.cnpj}, ${c.address} ("nós"). Somos os responsáveis (controladores) pelos seus dados pessoais, nos termos da Lei Geral de Proteção de Dados (LGPD – Lei nº 13.709/2018). Encarregado de dados (DPO): ${c.dpo} – ${c.email}. Última atualização: ${c.updatedAt}.`,
  ],
  [
    'Dados que você nos dá',
    'Cadastro: nome, nome de usuário, e-mail, senha (guardada de forma criptografada) e, se quiser, telefone. Perfil: foto, capa, biografia e, de forma opcional, cidade, estado, gênero, ano de nascimento e interesses. Conteúdo: publicações (fotos, vídeos e textos), stories, comentários, mensagens privadas, curtidas e "não curti", denúncias, notas dadas às lives e mensagens enviadas no chat das lives.',
  ],
  [
    'Dados gerados pelo uso',
    'Quem você segue e quem segue você; visualizações de publicações, vídeos, stories, lives e visitas a perfis (usadas para as estatísticas do Painel do político); quem viu seus stories; participação em lives e debates; aparelhos e horários de login (para os alertas de segurança e "Onde você está conectado").',
  ],
  [
    'Câmera, microfone e fotos',
    'O app só usa a câmera e o microfone quando você entra numa live ou debate para falar, ou quando grava/escolhe uma foto ou vídeo. Nas lives, o vídeo e o áudio são transmitidos em tempo real para quem está assistindo e não são gravados por nós. Você pode desligar câmera e microfone a qualquer momento dentro da live ou nas configurações do celular.',
  ],
  [
    'Dados que podem revelar opinião política',
    'Pela natureza do Polarizei, seguir um político, apoiá-lo ou participar de debates pode revelar sua opinião política, que a LGPD considera dado sensível. Esses dados são tratados para fazer a rede social funcionar (execução do contrato com você) e, quando houver compartilhamento com um político, somente com o seu consentimento específico (veja "Autorizações da plataforma").',
  ],
  [
    'Para que usamos',
    'Criar e manter sua conta; mostrar seu perfil e o que você publica; montar o feed, as lives e as notificações; permitir mensagens e debates; proteger a conta (dois fatores, alertas de login, combate a fraudes e abusos); analisar denúncias e cumprir a lei; gerar estatísticas agregadas para o Painel do político; e, para contas de político, processar o impulsionamento pago.',
  ],
  [
    'Estatísticas anônimas',
    'Políticos veem apenas números agregados e anônimos do público deles (por exemplo: "30% têm de 25 a 34 anos"). Ninguém é identificado nesses números.',
  ],
  [
    'Autorizações da plataforma',
    'Ao tocar em "Quero receber novidades" no perfil de um político, você autoriza aquele político a receber seu nome, cidade, faixa etária, interesses e contato (e-mail e WhatsApp, se cadastrados) para te enviar notícias, convites e comunicados. Nada é compartilhado com políticos em que você não tocou. Você pode alterar ou cancelar cada autorização a qualquer momento em Configurações › Autorizações da plataforma.',
  ],
  [
    'Conteúdo impulsionado',
    'Contas de político podem pagar para que um conteúdo apareça para mais pessoas, sempre com a marca "Impulsionado". Para escolher quem vê, usamos apenas os dados opcionais do perfil (cidade, estado, gênero, faixa de idade e interesses). O político não recebe a identidade de quem viu, só números totais. Pagamentos são processados pelo Mercado Pago; não guardamos dados de cartão.',
  ],
  [
    'Com quem compartilhamos',
    'Não vendemos seus dados. Usamos fornecedores que tratam dados em nosso nome, com contrato e medidas de segurança: Supabase (banco de dados, login e armazenamento de arquivos), LiveKit (transmissão de vídeo e áudio das lives), Mercado Pago (pagamentos do impulsionamento) e as lojas Google Play e App Store (distribuição do app). Alguns desses fornecedores podem guardar dados fora do Brasil, com as garantias exigidas pela LGPD. Também podemos fornecer dados quando a lei ou uma ordem judicial exigir, inclusive à Justiça Eleitoral.',
  ],
  [
    'O que é público',
    'Seu nome, nome de usuário, foto, biografia, publicações, comentários e participação em lives ficam visíveis para outros usuários, conforme suas configurações de privacidade (conta pública ou privada). Mensagens privadas só são vistas por quem participa da conversa.',
  ],
  [
    'Por quanto tempo guardamos',
    'Enquanto sua conta existir. Quando você exclui a conta, apagamos na hora seu perfil e tudo o que você publicou (posts, stories, comentários, mensagens, curtidas, seguidores, autorizações e estatísticas). Cópias de segurança são apagadas automaticamente em até 30 dias. Podemos manter por mais tempo apenas o que a lei obrigar (por exemplo, registros de acesso por 6 meses, pelo Marco Civil da Internet, e registros de pagamento pelo prazo fiscal).',
  ],
  [
    'Seus direitos (LGPD)',
    `Você pode: confirmar que tratamos seus dados e acessá-los; baixar uma cópia (Configurações › Informações pessoais › Baixar meus dados); corrigir dados (Editar perfil e Informações pessoais); cancelar autorizações e consentimentos; e excluir a conta (Configurações › Excluir minha conta). Para qualquer outro pedido, escreva para ${c.email}. Você também pode reclamar à Autoridade Nacional de Proteção de Dados (ANPD).`,
  ],
  [
    'Excluir sua conta',
    `No app: Configurações › Excluir minha conta. Sem acesso ao app: envie um e-mail para ${c.email} a partir do e-mail cadastrado, com o assunto "Excluir minha conta", e excluímos em até 15 dias.`,
  ],
  ['Segurança', 'Usamos conexão criptografada, senhas criptografadas, regras de acesso no banco de dados (cada pessoa só acessa o que pode), autenticação em dois fatores opcional e alertas de login. Nenhum sistema é 100% seguro; se houver um incidente que afete você, avisaremos.'],
  ['Menores de idade', 'O Polarizei não é destinado a menores de 18 anos. Se soubermos que uma conta pertence a um menor, ela será excluída.'],
  ['Mudanças nesta política', 'Se mudarmos algo importante, avisaremos no app antes de a mudança valer. A data da última atualização fica no início desta política.'],
];
