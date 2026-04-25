const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();
(async () => {
  const admin = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SECRET_KEY, { auth: { autoRefreshToken: false, persistSession: false } });
  const email = `juridix.qa+co${Date.now()}@gmail.com`;
  const { data: c } = await admin.auth.admin.createUser({ email, password: 'TestPwd123!', email_confirm: true });
  const sb = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_PUBLISHABLE_KEY);
  const { data: si } = await sb.auth.signInWithPassword({ email, password: 'TestPwd123!' });
  const tok = si.session.access_token;
  const r = await fetch('http://localhost:3000/api/stripe/checkout', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + tok },
    body: '{}'
  });
  const j = await r.json();
  console.log('status:', r.status);
  console.log('body:', JSON.stringify(j, null, 2));
  await admin.auth.admin.deleteUser(c.user.id);
})().catch(e => console.error('FATAL', e));
