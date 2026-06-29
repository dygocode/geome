import express from 'express';
import cors from 'cors';
import https from 'https';
import fs from 'fs';
import { createClient } from '@supabase/supabase-js';

const app = express();
app.use(cors());
app.use(express.json());

// ── Supabase (service role for backend) ──────────────────────
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

// ── Banco Inter (mTLS with certificate) ─────────────────────
const INTER_API = 'https://cdpj.partners.bancointer.com.br';
const INTER_CLIENT_ID = process.env.INTER_CLIENT_ID;
const INTER_CLIENT_SECRET = process.env.INTER_CLIENT_SECRET;
const INTER_PIX_KEY = process.env.INTER_PIX_KEY;

// Load certificate and key for mTLS
const interCert = fs.readFileSync('./Inter API_Certificado.crt');
const interKey = fs.readFileSync('./Inter API_Chave.key');

function interFetch(url, options = {}) {
  return new Promise((resolve, reject) => {
    const parsedUrl = new URL(url);
    const reqOptions = {
      hostname: parsedUrl.hostname,
      path: parsedUrl.pathname + parsedUrl.search,
      method: options.method || 'GET',
      headers: options.headers || {},
      key: interKey,
      cert: interCert,
      rejectUnauthorized: true,
    };

    const req = https.request(reqOptions, (res) => {
      let data = '';
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => {
        resolve({
          ok: res.statusCode >= 200 && res.statusCode < 300,
          status: res.statusCode,
          json: () => Promise.resolve(JSON.parse(data)),
          text: () => Promise.resolve(data),
        });
      });
    });

    req.on('error', reject);
    if (options.body) req.write(options.body);
    req.end();
  });
}

let interToken = null;
let interTokenExpires = 0;

async function getInterToken() {
  if (interToken && Date.now() < interTokenExpires) return interToken;
  const creds = btoa(`${INTER_CLIENT_ID}:${INTER_CLIENT_SECRET}`);
  const res = await interFetch(`${INTER_API}/oauth/v2/token`, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${creds}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: 'grant_type=client_credentials',
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Inter auth failed: ${res.status} ${err}`);
  }
  const data = await res.json();
  interToken = data.access_token;
  interTokenExpires = Date.now() + (data.expires_in - 60) * 1000;
  return interToken;
}

// ── Routes ───────────────────────────────────────────────────

// Get or create subscription
app.post('/api/subscription', async (req, res) => {
  try {
    const { email } = req.body;

    const { data: existing } = await supabase
      .from('subscriptions')
      .select('*')
      .eq('email', email)
      .in('status', ['pending', 'active'])
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (existing) {
      const { data: payment } = await supabase
        .from('payments')
        .select('*')
        .eq('subscription_id', existing.id)
        .eq('status', 'pending')
        .limit(1)
        .maybeSingle();
      return res.json({ subscription: existing, payment: payment || null });
    }

    const { data: plan } = await supabase
      .from('subscription_plans')
      .select('*')
      .eq('active', true)
      .limit(1)
      .single();

    const { data: sub, error } = await supabase
      .from('subscriptions')
      .insert({
        email,
        plan_id: plan.id,
        analyses_used: 0,
        analyses_limit: 5,
        status: 'pending',
      })
      .select()
      .single();

    if (error) throw error;
    res.json({ subscription: sub, payment: null });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Check if user can use analysis
app.post('/api/subscription/check', async (req, res) => {
  try {
    const { email } = req.body;
    const { data: sub } = await supabase
      .from('subscriptions')
      .select('*')
      .eq('email', email)
      .eq('status', 'active')
      .gt('expires_at', new Date().toISOString())
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!sub) return res.json({ allowed: false, remaining: 0, subscription: null });
    const remaining = sub.analyses_limit - sub.analyses_used;
    res.json({ allowed: remaining > 0, remaining, subscription: sub });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Generate PIX payment
app.post('/api/pix/create', async (req, res) => {
  try {
    const { subscription_id, email, amount_cents } = req.body;

    const token = await getInterToken();

    const cobRes = await interFetch(`${INTER_API}/pix/v2/cob`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        calendario: { expiracao: 3600 },
        valor: { original: (amount_cents / 100).toFixed(2) },
        chave: INTER_PIX_KEY,
        solicitacaoPagador: `Geome - Plano Basico - ${email}`,
        loc: { tipo: 'cob' },
      }),
    });

    if (!cobRes.ok) {
      const err = await cobRes.text();
      throw new Error(`Inter PIX failed: ${cobRes.status} ${err}`);
    }

    const cobData = await cobRes.json();

    const qrRes = await interFetch(`${INTER_API}/pix/v2/loc/${cobData.loc.id}/qrcode`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const qrData = await qrRes.json();

    const { data: payment, error: dbErr } = await supabase
      .from('payments')
      .insert({
        subscription_id,
        external_id: cobData.txid,
        amount_cents,
        currency: 'BRL',
        status: 'pending',
        pix_copy_paste: qrData.pixCopiaECola,
        pix_qr_code: qrData.imagemQrcode,
        bank_code: '077',
        agency: '0001-9',
      })
      .select()
      .single();

    if (dbErr) throw dbErr;

    res.json({
      payment_id: payment.id,
      pix_copy_paste: qrData.pixCopiaECola,
      pix_qr_code: qrData.imagemQrcode,
      txid: cobData.txid,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Check payment status
app.post('/api/pix/check', async (req, res) => {
  try {
    const { payment_id } = req.body;

    const { data: payment } = await supabase
      .from('payments')
      .select('*')
      .eq('id', payment_id)
      .single();

    if (!payment) return res.json({ paid: false });
    if (payment.status === 'approved') return res.json({ paid: true });

    const token = await getInterToken();
    const cobRes = await interFetch(`${INTER_API}/pix/v2/cob/${payment.external_id}`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!cobRes.ok) return res.json({ paid: false });

    const cobData = await cobRes.json();
    const paid = cobData.status === 'CONCLUIDA';

    if (paid) {
      await supabase
        .from('payments')
        .update({ status: 'approved', paid_at: new Date().toISOString() })
        .eq('id', payment_id);

      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 30);

      await supabase
        .from('subscriptions')
        .update({ status: 'active', expires_at: expiresAt.toISOString() })
        .eq('id', payment.subscription_id);
    }

    res.json({ paid });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Increment usage
app.post('/api/subscription/increment', async (req, res) => {
  try {
    const { subscription_id } = req.body;
    const { data: sub } = await supabase
      .from('subscriptions')
      .select('analyses_used')
      .eq('id', subscription_id)
      .single();

    if (!sub) return res.status(404).json({ error: 'Not found' });

    await supabase
      .from('subscriptions')
      .update({ analyses_used: sub.analyses_used + 1 })
      .eq('id', subscription_id);

    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`Geome API running on http://localhost:${PORT}`));
