import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseTweetfeed } from '../../src/collectors/tweetfeed.ts';

// nach der echten Form von month.csv nachgebaut (keine Kopfzeile, Spalten date,user,type,value,tags,tweet_url)
const L = (t: string, tags: string) => `${t},user,domain,example.com,${tags},https://x.com/u/status/1`;
const SAMPLE = [
  L('2026-11-10 05:00:00', '#phishing'), // erster Tag, angeschnitten
  L('2026-11-11 01:00:00', '#phishing'),
  L('2026-11-11 02:00:00', '#malware #C2'),
  L('2026-11-11 03:00:00', ''),
  L('2026-11-12 03:00:00', '#ransomware'),
  L('2026-11-14 03:00:00', '#malware'), // gestern: entfällt
  L('2026-11-15 03:00:00', '#malware'), // heute: entfällt
].join('\n');

test('Normalfall: Tage zählen, Malware-Tags erkennen, erster Tag und neueste zwei Tage entfallen', () => {
  const r = parseTweetfeed(SAMPLE, new Date('2026-11-15T10:00:00Z'));
  assert.deepEqual(r, [{ day: '2026-11-11', all: 3, malware: 1 }, { day: '2026-11-12', all: 1, malware: 1 }]);
});
test('leere Antwort', () => {
  assert.throws(() => parseTweetfeed('', new Date()), /Antworttext/);
  assert.throws(() => parseTweetfeed('kaputt\nnoch mehr', new Date()), /keine gültigen Zeilen/);
});
test('fehlendes Feld: Zeile ohne Tags-Spalte zählt, aber ohne Malware-Tag', () => {
  const r = parseTweetfeed(`2026-11-10 05:00:00,u,ip,1.2.3.4\n2026-11-11 05:00:00,u,ip,1.2.3.4\n`, new Date('2026-11-20T00:00:00Z'));
  assert.deepEqual(r, [{ day: '2026-11-11', all: 1, malware: 0 }]);
});
