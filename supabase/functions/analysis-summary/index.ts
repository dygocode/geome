import { serve } from "https://deno.land/std@0.177.0/http/server.ts";

const OPENROUTER_API_KEY = Deno.env.get("OPENROUTER_API_KEY")!;
const OPENROUTER_API = "https://openrouter.ai/api/v1";
const FRONTEND_URL = Deno.env.get("FRONTEND_URL") || "https://geome-app.vercel.app";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const MODELS = ["nvidia/nemotron-3-super-120b-a12b:free", "meta-llama/llama-3.3-70b-instruct:free", "tencent/hy3:free"];

async function callModel(model: string, messages: any[]): Promise<string> {
  const res = await fetch(`${OPENROUTER_API}/chat/completions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${OPENROUTER_API_KEY}`,
      "Content-Type": "application/json",
      "HTTP-Referer": FRONTEND_URL,
      "X-Title": "Geome - Summary",
    },
    body: JSON.stringify({ model, messages, temperature: 0.7, max_tokens: 2000 }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(`OpenRouter ${res.status}: ${JSON.stringify(data)}`);
  return data.choices[0].message.content;
}

function parseJson(content: string): any {
  return JSON.parse(content.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim());
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { companyName, segment, platformResults } = await req.json();

    const resultsText = platformResults.map((p: any) => `- ${p.platform} (score: ${p.score}): ${p.context}`).join('\n');

    const prompt = `Com base nas analises das plataformas de IA para a empresa "${companyName}" (segmento: ${segment}), gere um resumo e recomendacoes.

Dados das plataformas:
${resultsText}

Retorne APENAS um objeto JSON (sem markdown, sem crases):
{
  "summary": "<resumo de 2-3 frases em portugues sobre a presenca da marca nas plataformas de IA>",
  "recommendations": [
    "<recomendacao acionavel 1 em portugues>",
    "<recomendacao acionavel 2 em portugues>",
    "<recomendacao acionavel 3 em portugues>"
  ]
}

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

    if (!result) {
      result = {
        summary: `Analise de presenca da marca ${companyName} nas principais plataformas de IA.`,
        recommendations: [
          "Aumente a publicacao de conteudo tecnico no site",
          "Participe de discussoes sobre inovacao no setor",
          "Garanta informacoes atualizadas em fontes publicas",
        ],
      };
    }

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
