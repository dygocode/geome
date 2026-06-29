import type { BrandPresenceResult } from '../types';

export const mockBrandPresenceResult: BrandPresenceResult = {
  overallScore: 72,
  brandMentions: [
    {
      platform: 'ChatGPT',
      score: 78,
      context: 'Sua empresa e moderadamente mencionada no contexto de servicos de tecnologia no Brasil.',
      examples: [
        'Mencionada 12 vezes em consultas sobre empresas de software',
        'Associada a servicos de transformacao digital',
      ],
    },
    {
      platform: 'Claude',
      score: 65,
      context: 'Presenca media com foco em conteudo tecnico e documentacao.',
      examples: [
        'Citada em 8 discussoes sobre arquitetura de software',
        'Referenciada em comparativos de empresas do segmento',
      ],
    },
    {
      platform: 'Gemini',
      score: 80,
      context: 'Boa visibilidade em respostas sobre empresas brasileiras de tecnologia.',
      examples: [
        'Presente em 15 respostas sobre empresas de TI',
        'Mencionada em listas de fornecedores recomendados',
      ],
    },
    {
      platform: 'Perplexity',
      score: 68,
      context: 'Presenca moderada com aparecimento em pesquisas sobre o setor.',
      examples: [
        'Aparece em 5 fontes citadas sobre o mercado',
        'Referenciada em artigos sobre inovacao',
      ],
    },
  ],
  summary:
    'Sua empresa possui uma presenca moderada nas principais plataformas de IA. O indice geral de 72 pontos indica que ha espaco significativo para crescimento na visibilidade da sua marca no contexto de LLMs.',
  recommendations: [
    'Aumente a publicacao de conteudo tecnico de alta qualidade no site da empresa',
    'Participe ativamente de discussoes e artigos sobre inovacao no setor',
    'Garanta que informacoes atualizadas sobre a empresa estejam disponiveis em fontes publicas',
    'Crie case studies detalhados que possam ser referenciados por modelos de IA',
    'Considere publicacoes em midias especializadas do seu segmento',
  ],
};
