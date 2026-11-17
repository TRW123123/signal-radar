import test from 'node:test';
import assert from 'node:assert/strict';
import collector, { parse, parseTimestamps } from '../../src/collectors/urlhaus.ts';

// Nach Doku nachgebaut (kommentierte CSV).
const SAMPLE = `################################################################
# abuse.ch URLhaus Database Dump (CSV)
################################################################
# id,dateadded,url,url_status,last_online,threat,tags,urlhaus_link,reporter
"1","2026-11-16 12:05:00","http://a.example/x","online","2026-11-16 12:05:00","malware_download","elf","https://urlhaus.abuse.ch/url/1/","r"
"2","2026-11-16 13:10:00","http://b.example/x","online","2026-11-16 13:10:00","malware_download","elf","https://urlhaus.abuse.ch/url/2/","r"
"3","2026-11-16 13:50:00","http://c.example/x","offline","2026-11-16 13:50:00","malware_download","elf","https://urlhaus.abuse.ch/url/3/","r"
"4","2026-11-16 15:20:00","http://d.example/x","online","2026-11-16 15:20:00","malware_download","elf","https://urlhaus.abuse.ch/url/4/","r"
`;
const NOW = new Date('2026-11-16T16:30:00Z');

test('Normalfall', () => {
  assert.deepEqual(parse(SAMPLE, NOW).map((x) => x.value), [2, 0, 1]);
});

test('leere Antwort', () => {
  assert.throws(() => parse('', NOW), /unerwartete Antwort/);
});

test('fehlendes Feld: kaputte Zeilen übersprungen', () => {
  assert.equal(parseTimestamps('# id,dateadded\n"1","kaputt"\n"2"\n').length, 0);
  assert.equal(collector.signals[0].id, 'cyber.threat.urlhaus_volume');
  assert.equal(collector.needsKey, 'SR_ABUSECH_KEY');
});
