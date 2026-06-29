# Supabase Edge Functions - Deploy Guide

## 1. Install Supabase CLI

```bash
npm install supabase --save-dev
```

## 2. Login to Supabase

```bash
npx supabase login
```

## 3. Link your project

```bash
npx supabase link --project-ref cmyvmtzabxxppxqcnvyt
```

## 4. Set secrets (Edge Functions environment variables)

```bash
npx supabase secrets set INTER_CLIENT_ID=6155e9f5-b10e-4dde-bcf4-ac88bd99a0ac
npx supabase secrets set INTER_CLIENT_SECRET=70fa5375-0e54-4b42-b4b1-7087543f8f96
npx supabase secrets set INTER_PIX_KEY=your-pix-key
```

## 5. Deploy functions

```bash
npx supabase functions deploy inter-create-pix
npx supabase functions deploy inter-check-payment
```

## 6. Run SQL schema

Go to Supabase Dashboard > SQL Editor and run `schema.sql`.

## 7. Update .env

```bash
# .env
VITE_SUPABASE_URL=https://cmyvmtzabxxppxqcnvyt.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```

## Edge Functions

| Function | URL | Purpose |
|---|---|---|
| `inter-create-pix` | `/.netlify/functions/inter-create-pix` | Creates PIX charge via Inter API, saves payment to DB |
| `inter-check-payment` | `/.netlify/functions/inter-check-payment` | Checks if PIX was paid, activates subscription |

## Flow

1. Frontend calls `supabase.functions.invoke('inter-create-pix', { body })`
2. Edge function authenticates with Inter API (server-side, secret safe)
3. Creates PIX charge, returns QR code + copy-paste
4. Frontend shows QR to user
5. User pays PIX
6. Frontend calls `inter-check-payment` to verify
7. Edge function checks Inter API status, updates DB if paid
8. Subscription activated, user can run analyses
