# Plan: OpenRouter LLM Integration for Brand Analysis

## Goal
Replace the mocked `handleAnalysis()` with real LLM calls via OpenRouter. Each analysis queries 3 free models (Gemini, ChatGPT, Claude) to evaluate a company's brand presence across AI platforms.

## Files to Modify

| File | Change |
|---|---|
| `supabase/functions/api/index.ts` | Add OpenRouter helper, replace mock with real LLM call |
| `supabase/functions/api/index.ts` | Add env var `OPENROUTER_API_KEY` |

**No changes needed:** frontend types, database schema, or other backend routes — the `BrandPresenceResult` shape stays the same.

## Implementation

### Step 1: Add Environment Variable

```ts
const OPENROUTER_API_KEY = Deno.env.get("OPENROUTER_API_KEY")!;
```

Deploy secret:
```bash
bunx supabase secrets set OPENROUTER_API_KEY=your-key-here
```

### Step 2: Add `openrouterFetch()` Helper

Analogous to the existing `mpFetch()`:

```ts
const OPENROUTER_API = "https://openrouter.ai/api/v1";

async function openrouterFetch(model: string, messages: any[]): Promise<string> {
  const res = await fetch(`${OPENROUTER_API}/chat/completions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${OPENROUTER_API_KEY}`,
      "Content-Type": "application/json",
      "HTTP-Referer": FRONTEND_URL,
      "X-Title": "Geome Brand Analysis",
    },
    body: JSON.stringify({
      model,
      messages,
      temperature: 0.7,
      max_tokens: 2000,
    }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(`OpenRouter ${res.status}: ${JSON.stringify(data)}`);
  return data.choices[0].message.content;
}
```

### Step 3: Build the Analysis Prompt

A single prompt that asks the LLM to evaluate brand presence across all 3 platforms:

```ts
function buildAnalysisPrompt(company: {
  companyName: string;
  website: string;
  segment: string;
  location: string;
}): string {
  return `You are a brand presence analyst. Evaluate how well the company "${company.companyName}" 
(${company.website}, segment: ${company.segment}, location: ${company.location}) 
would appear in responses from ChatGPT, Claude, and Gemini.

Return ONLY a JSON object with this exact structure (no markdown, no code fences):
{
  "overallScore": <number 0-100>,
  "brandMentions": [
    {
      "platform": "ChatGPT",
      "score": <number 0-100>,
      "context": "<1-2 sentences about how this platform would describe/mention the company>",
      "examples": ["<example query or response where the company might appear>"]
    },
    {
      "platform": "Claude",
      "score": <number 0-100>,
      "context": "...",
      "examples": ["..."]
    },
    {
      "platform": "Gemini",
      "score": <number 0-100>,
      "context": "...",
      "examples": ["..."]
    }
  ],
  "summary": "<2-3 sentence overall summary of brand presence across AI platforms>",
  "recommendations": [
    "<actionable recommendation 1>",
    "<actionable recommendation 2>",
    "<actionable recommendation 3>"
  ]
}

Score guidelines:
- 90-100: Company is widely known and frequently mentioned
- 70-89: Company has solid presence, mentioned in relevant contexts
- 50-69: Moderate presence, appears in some relevant queries
- 30-49: Limited presence, rarely mentioned
- 0-29: Virtually unknown to AI models`;
}
```

### Step 4: Replace Mock in `handleAnalysis()`

Replace the random data block (lines 330-352) with:

```ts
const models = [
  "google/gemini-2.0-flash-exp:free",
  "openai/gpt-4o-mini:free", 
  "anthropic/claude-3-haiku:free",
];

const prompt = buildAnalysisPrompt({ companyName, website, segment, location });

// Query each model and pick the best/first successful response
let result: BrandPresenceResult | null = null;
let lastError: Error | null = null;

for (const model of models) {
  try {
    const content = await openrouterFetch(model, [
      { role: "user", content: prompt }
    ]);
    
    // Parse JSON from response (strip markdown fences if present)
    const cleaned = content.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
    result = JSON.parse(cleaned) as BrandPresenceResult;
    break; // success — stop trying other models
  } catch (err) {
    lastError = err;
    continue; // try next model
  }
}

if (!result) {
  throw new Error(`All models failed. Last error: ${lastError?.message}`);
}
```

**Fallback strategy:** Try models in order (Gemini → GPT-4o-mini → Claude). If one fails (timeout, rate limit, error), try the next. This gives resilience without extra complexity.

**Why not parallel?** Free tier models have strict rate limits. Sequential with fallback is more reliable and avoids 429 errors.

### Step 5: Keep DB Logic Unchanged

The existing DB insert chain (companies → analyses → platform_mentions) already expects the `BrandPresenceResult` shape. No changes needed there.

## Deployment Steps

1. Set the OpenRouter API key as a Supabase secret
2. Deploy the updated Edge Function
3. Test via the frontend form

```bash
bunx supabase secrets set OPENROUTER_API_KEY=your-key-here
bunx supabase functions deploy api
```

## Verification

1. Open the app at `https://geome-dygosd.vercel.app/form`
2. Fill in the company form and submit
3. Verify the result shows real analysis (not random scores)
4. Check that each platform card has meaningful context and examples
5. Check Supabase dashboard → `analyses` table has real data
6. Test with an invalid email to verify error handling works

## Cost Estimate

Free tier models = $0 cost per analysis. Each analysis makes 1 API call (with up to 3 fallback attempts). Free tiers typically allow ~10-20 requests/day per model.
