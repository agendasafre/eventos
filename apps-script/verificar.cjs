// Pruebas locales: Supabase, fetch y GmailApp se simulan, sin red ni correos.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.resolve(__dirname, '..');
const script = fs.readFileSync(path.join(__dirname, 'Code.gs'), 'utf8');
const mails = [];
const context = vm.createContext({
  console,
  GmailApp: { sendEmail: (...args) => mails.push(args) },
  ContentService: { createTextOutput: (text) => text },
});
vm.runInContext(script, context);

const guest = {
  id: 1, dni: '30123456', nombre: 'Invitado de prueba',
  correo: 'prueba@example.com', mesa_token: 'token-prueba',
  retiro: false, es_manual: true, opciones_comun: 1,
};
const registration = {
  dni: guest.dni, nombre: guest.nombre, correo: guest.correo,
  comun: 1, total: 1, mesa_token: guest.mesa_token,
};
const expectedLink = 'https://unsj-cena.vercel.app/mesas?token=token-prueba';
assert.equal(context.mailRegistroManual(registration), 'OK');
assert.ok(mails.at(-1)[3].htmlBody.includes(expectedLink));
assert.ok(mails.at(-1)[3].htmlBody.includes('4 cuotas'));
assert.ok(mails.at(-1)[3].htmlBody.includes('$70000'));
assert.ok(mails.at(-1)[3].htmlBody.includes('$17500'));
context.mailRegistro(registration);
assert.ok(!mails.at(-1)[3].htmlBody.includes('Gestionar asiento/s'));
assert.ok(mails.at(-1)[3].htmlBody.includes('$80000'));
context.mailRegistroManual({ ...registration, mesa_token: null });
assert.ok(!mails.at(-1)[3].htmlBody.includes('Gestionar asiento/s'));
assert.ok(context.enlaceMesas('a&b ?').includes('token=a%26b%20%3F'));
context.mailRetiro({ invitado: guest, total: 1, numeros: [1], mesa_token: guest.mesa_token, es_manual: true });
assert.ok(mails.at(-1)[3].htmlBody.includes(expectedLink));
context.mailResumenMesas({ invitado: guest, asientos: [{ mesa: 2, posicion: 1 }], mesa_token: guest.mesa_token });
assert.ok(mails.at(-1)[3].htmlBody.includes(expectedLink));

async function invokeEndpoint(file, body, initialGuest) {
  let savedGuest = initialGuest ? { ...initialGuest } : null;
  const payloads = [];
  const client = {
    from(table) {
      assert.equal(table, 'invitados');
      let update = null;
      let tokenLookup = false;
      const chain = {
        select() { return chain; },
        eq(column) { tokenLookup = column === 'mesa_token'; return chain; },
        update(data) { update = data; return chain; },
        insert(data) { update = data; return chain; },
        maybeSingle() {
          if (update) savedGuest = { ...savedGuest, id: 1, ...update };
          return Promise.resolve({ data: tokenLookup && !update ? null : savedGuest, error: null });
        },
      };
      return chain;
    },
  };
  const source = fs.readFileSync(path.join(root, file), 'utf8')
    .replace(/^import .*from '@supabase\/supabase-js';\r?\n/m, '')
    .replace('export default async function handler', 'async function handler');
  const sandbox = vm.createContext({
    console,
    process: { env: { SUPABASE_URL: 'https://example.com', SUPABASE_SERVICE_KEY: 'fake', SCRIPT_URL: 'https://example.com/script' } },
    createClient: () => client,
    fetch: async (_url, options) => {
      payloads.push(JSON.parse(options.body));
      return { ok: true, text: async () => 'OK' };
    },
  });
  vm.runInContext(source, sandbox);
  const response = {
    status(code) { this.code = code; return this; },
    json(data) { this.data = data; return this; },
  };
  await sandbox.handler({ method: 'POST', headers: {}, body }, response);
  assert.equal(response.code, 200);
  return { payload: payloads[0], savedGuest };
}

(async () => {
  const body = { ...registration, enviar_mail: true };
  for (const existing of [guest, null]) {
    const { payload, savedGuest } = await invokeEndpoint('api/manual.js', body, existing);
    assert.equal(payload.action, 'mail_registro_manual');
    assert.ok(payload.mesa_token);
    assert.equal(payload.mesa_token, savedGuest.mesa_token);
    if (existing) assert.equal(payload.mesa_token, guest.mesa_token);
    context.mailRegistroManual(payload);
    assert.ok(mails.at(-1)[3].htmlBody.includes(encodeURIComponent(savedGuest.mesa_token)));
  }
  const resend = { tipo: 'registro', dni: guest.dni };
  const manual = await invokeEndpoint('api/reenviar.js', resend, guest);
  assert.equal(manual.payload.mesa_token, guest.mesa_token);
  assert.equal(manual.payload.action, 'mail_registro_manual');
  const regular = await invokeEndpoint('api/reenviar.js', resend, { ...guest, es_manual: false });
  assert.equal(regular.payload.action, 'mail_registro');
  assert.ok(!('mesa_token' in regular.payload));
  console.log('OK: alta manual, actualización, reenvío, enlaces, correos y 4 cuotas; sin llamadas externas.');
})().catch((err) => { console.error(err); process.exitCode = 1; });
