import { serve } from "https://deno.land/std@0.177.0/http/server.ts";

const OPENROUTER_API_KEY = Deno.env.get("OPENROUTER_API_KEY")!;
const OPENROUTER_API = "https://openrouter.ai/api/v1";
const FRONTEND_URL = Deno.env.get("FRONTEND_URL") || "https://geome-app.vercel.app";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const MODELS = [
  "qwen/qwen3-next-80b-a3b-instruct:free",
  "nousresearch/hermes-3-llama-3.1-405b:free",
  "meta-llama/llama-3.3-70b-instruct:free",
  "nvidia/nemotron-3-super-120b-a12b:free",
];

async function callModel(model: string, messages: any[]): Promise<string> {
  for (let attempt = 0; attempt < 2; attempt++) {
    const res = await fetch(`${OPENROUTER_API}/chat/completions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${OPENROUTER_API_KEY}`,
        "Content-Type": "application/json",
        "HTTP-Referer": FRONTEND_URL,
        "X-Title": "Geome - Claude Analysis",
      },
      body: JSON.stringify({ model, messages, temperature: 0.7, max_tokens: 2000 }),
    });
    const data = await res.json();
    if (res.ok) return data.choices[0].message.content;
    if (res.status === 429 && attempt < 1) {
      const wait = Number(res.headers.get("retry-after")) || 5;
      await new Promise((r) => setTimeout(r, Math.min(wait, 10) * 1000));
      continue;
    }
    throw new Error(`OpenRouter ${res.status}: ${JSON.stringify(data)}`);
  }
  throw new Error(`OpenRouter: retries exhausted for ${model}`);
}

function parseJson(content: string): any {
  return JSON.parse(content.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim());
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { companyName, website, segment, location } = await req.json();

    const prompt = `Voce e o modelo de IA "Claude". Analise quao bem a empresa "${companyName}" (${website}, segmento: ${segment}, localizacao: ${location}) apareceria nas suas respostas.

IMPORTANTE: Responda APENAS sobre a plataforma "Claude". Nao mencione outras plataformas.

Retorne APENAS um objeto JSON (sem markdown, sem crases):
{
  "score": <numero 0-100>,
  "context": "<1-2 frases em portugues sobre como voce, como Claude, descreveria/mencionaria esta empresa>",
  "examples": ["<exemplo de consulta ou resposta onde a empresa poderia aparecer, em portugues>"],
  "competitors": [
    {
      "name": "<nome de um concorrente real no mesmo nicho>",
      "score": <numero 0-100>,
      "context": "<frase em portugues sobre por que este concorrente aparece mais/menos>"
    }
  ]
}

Diretrizes de pontuacao:
- 90-100: Empresa amplamente conhecida e frequentemente mencionada
- 70-89: Empresa com presenca solida, mencionada em contextos relevantes
- 50-69: Presenca moderada, aparece em algumas consultas relevantes
- 30-49: Presenca limitada, raramente mencionada
- 0-29: Praticamente desconhecida para voce

Para os concorrentes: identifique 2-3 empresas reais do mesmo segmento que provavelmente teriam presenca nas respostas desta plataforma.

LEMBRE-SE: Todo texto DEVE estar em portugues do Brasil. Responda SOMENTE com o JSON.`;

    let result = null;
    let lastError: Error | null = null;

    for (const model of MODELS) {
      try {
        const content = await callModel(model, [{ role: "user", content: prompt }]);
        result = parseJson(content);
        break;
      } catch (err) {
        lastError = err as Error;
        continue;
      }
    }

    if (!result) throw new Error(`Claude analysis failed: ${lastError?.message}`);

    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }
});
