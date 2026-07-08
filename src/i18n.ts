export type Locale = 'pt-BR' | 'en';

interface Translations {
  [key: string]: { [key: string]: string };
}

const translations: Translations = {
  'pt-BR': {
    'brandPresenceScore': 'Brand Presence Score',
    'presenceByPlatform': 'Presenca por Plataforma',
    'recommendations': 'Recomendacoes',
    'competitors': 'Concorrentes',
    'newAnalysis': 'Nova Analise',
    'analysisRemaining': 'analise restante',
    'analysesRemaining': 'analises restantes',
    'planExpired': 'Seu plano expirou. Renove para continuar analisando.',
    'renew': 'Renovar',
    'processingAnalysis': 'Processando sua analise...',
    'limitReached': 'Limite Atingido',
    'renewPlan': 'Renovar Plano',
    'limitMessage': 'Voce utilizou todas as {limit} analises do seu plano.',
    'limitSubmessage': 'Renove para receber mais 5 analises e continuar analisando sua presenca nas IAs.',
    'generatePayment': 'Gerando pagamento...',
    'unlockAnalysis': 'Desbloquear Analise',
    'analyses': 'analises',
    'payViaPix': 'Pague via PIX',
    'mercadoPago': 'Mercado Pago',
    'copyPixCode': 'Copiar codigo PIX',
    'copied': 'Copiado!',
    'alreadyPaid': 'Ja paguei',
    'verifying': 'Verificando...',
    'paymentConfirmed': 'O pagamento e confirmado automaticamente em segundos.',
    'paymentNotConfirmed': 'Pagamento ainda nao confirmado. Aguarde alguns instantes.',
    'paymentError': 'Erro ao verificar pagamento.',
    'loading': 'Preparando pagamento...',
    'noPayment': 'Nenhum pagamento encontrado.',
    'formTitle': 'Analise sua presenca nas IAs',
    'formDescription': 'Preencha os dados da sua empresa para descobrir como sua marca aparece nas plataformas de inteligencia artificial.',
    'companyName': 'Nome da empresa',
    'companyNamePlaceholder': 'Qual o nome da sua empresa?',
    'website': 'Site',
    'websitePlaceholder': 'www.exemplo.com',
    'segment': 'Segmento',
    'segmentPlaceholder': 'Selecione um segmento',
    'location': 'Localizacao da empresa',
    'locationPlaceholder': 'Estado, cidade ou pais',
    'contactName': 'Seu Nome',
    'contactNamePlaceholder': 'Qual o seu nome?',
    'email': 'Email',
    'emailPlaceholder': 'Qual seu e-mail corporativo?',
    'startAnalysis': 'Iniciar Analise',
    'analyzing': 'Analisando...',
  },
  'en': {
    'brandPresenceScore': 'Brand Presence Score',
    'presenceByPlatform': 'Presence by Platform',
    'recommendations': 'Recommendations',
    'competitors': 'Competitors',
    'newAnalysis': 'New Analysis',
    'analysisRemaining': 'analysis remaining',
    'analysesRemaining': 'analyses remaining',
    'planExpired': 'Your plan expired. Renew to continue analyzing.',
    'renew': 'Renew',
    'processingAnalysis': 'Processing your analysis...',
    'limitReached': 'Limit Reached',
    'renewPlan': 'Renew Plan',
    'limitMessage': 'You have used all {limit} analyses in your plan.',
    'limitSubmessage': 'Renew to receive 5 more analyses and continue analyzing your AI presence.',
    'generatePayment': 'Generating payment...',
    'unlockAnalysis': 'Unlock Analysis',
    'analyses': 'analyses',
    'payViaPix': 'Pay via PIX',
    'mercadoPago': 'Mercado Pago',
    'copyPixCode': 'Copy PIX code',
    'copied': 'Copied!',
    'alreadyPaid': 'I already paid',
    'verifying': 'Verifying...',
    'paymentConfirmed': 'Payment is confirmed automatically in seconds.',
    'paymentNotConfirmed': 'Payment not yet confirmed. Please wait a moment.',
    'paymentError': 'Error verifying payment.',
    'loading': 'Preparing payment...',
    'noPayment': 'No payment found.',
    'formTitle': 'Analyze your AI presence',
    'formDescription': 'Fill in your company details to discover how your brand appears on artificial intelligence platforms.',
    'companyName': 'Company name',
    'companyNamePlaceholder': 'What is your company name?',
    'website': 'Website',
    'websitePlaceholder': 'www.example.com',
    'segment': 'Segment',
    'segmentPlaceholder': 'Select a segment',
    'location': 'Company location',
    'locationPlaceholder': 'State, city or country',
    'contactName': 'Your name',
    'contactNamePlaceholder': 'What is your name?',
    'email': 'Email',
    'emailPlaceholder': 'What is your corporate email?',
    'startAnalysis': 'Start Analysis',
    'analyzing': 'Analyzing...',
  },
};

let currentLocale: Locale = (localStorage.getItem('locale') as Locale) || 'pt-BR';

export function setLocale(locale: Locale) {
  currentLocale = locale;
  localStorage.setItem('locale', locale);
}

export function getLocale(): Locale {
  return currentLocale;
}

export function t(key: string, params?: Record<string, string | number>): string {
  let text = translations[currentLocale]?.[key] || translations['pt-BR'][key] || key;
  if (params) {
    Object.entries(params).forEach(([k, v]) => {
      text = text.replace(`{${k}}`, String(v));
    });
  }
  return text;
}
