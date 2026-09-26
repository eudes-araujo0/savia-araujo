import assert from 'node:assert/strict';
import test from 'node:test';
import { requestFingerprint } from '../lib/request-security.ts';

test('limite público permanece por IP mesmo quando o User-Agent muda', async () => {
  const first = new Request('https://example.com/api/bookings', { headers: { 'x-forwarded-for': '203.0.113.10', 'user-agent': 'Browser A' } });
  const changedAgent = new Request('https://example.com/api/bookings', { headers: { 'x-forwarded-for': '203.0.113.10', 'user-agent': 'Browser B' } });
  const changedAddress = new Request('https://example.com/api/bookings', { headers: { 'x-forwarded-for': '203.0.113.11', 'user-agent': 'Browser A' } });
  assert.equal(await requestFingerprint(first, 'public-booking'), await requestFingerprint(changedAgent, 'public-booking'));
  assert.notEqual(await requestFingerprint(first, 'public-booking'), await requestFingerprint(changedAddress, 'public-booking'));
});
