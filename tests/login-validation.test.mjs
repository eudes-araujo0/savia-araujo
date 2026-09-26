import assert from 'node:assert/strict';
import test from 'node:test';
import { loginBodyMayExceedLimit, parseLoginPayload } from '../lib/login-validation.ts';

test('aceita apenas usuário e senha como strings', () => {
  assert.deepEqual(parseLoginPayload('{"username":" savia ","password":"senha-segura"}'), {
    ok: true,
    username: 'savia',
    password: 'senha-segura',
  });
});

for (const [name, raw] of [
  ['JSON vazio', ''],
  ['JSON malformado', '{'],
  ['objeto vazio', '{}'],
  ['usuário estruturado', '{"username":{},"password":"senha-segura"}'],
  ['senha estruturada', '{"username":"savia","password":{}}'],
  ['array no corpo', '[]'],
  ['campo não permitido', '{"username":"savia","password":"senha-segura","role":"master"}'],
]) {
  test(`rejeita ${name}`, () => {
    const result = parseLoginPayload(raw);
    assert.equal(result.ok, false);
    assert.equal(result.status, 400);
  });
}

test('rejeita corpo acima do limite', () => {
  const result = parseLoginPayload(JSON.stringify({ username: 'savia', password: 'x'.repeat(2_100) }));
  assert.equal(result.ok, false);
  assert.equal(result.status, 413);
  assert.equal(loginBodyMayExceedLimit('4096'), true);
});
