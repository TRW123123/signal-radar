import { test } from 'node:test';
import assert from 'node:assert/strict';
import { httpsHref } from '../frontend/js/https.js';

test('httpsHref lässt nur absolute https-URLs ohne Zugangsdaten durch', () => {
  assert.equal(httpsHref('https://example.org/a?b=1'), 'https://example.org/a?b=1');
  assert.equal(httpsHref('http://example.org/a'), '');
  assert.equal(httpsHref('javascript:alert(1)'), '');
  assert.equal(httpsHref('https://user:pw@example.org/a'), '');
  assert.equal(httpsHref('/relativ'), '');
  assert.equal(httpsHref(''), '');
  assert.equal(httpsHref('https://example.org/a b'), 'https://example.org/a%20b');
});
