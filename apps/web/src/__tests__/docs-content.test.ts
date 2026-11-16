import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { DOC_PAGES, DOC_GROUPS, DIAGRAM_NAMES, findPage, pagesByGroup, prevNext, headingsOf, readingMinutes, searchDocs, slugifyHeading } from '../lib/docs-content.ts';

describe('documentation content', () => {
  test('slugs are unique, url-safe and every page is complete', () => {
    const slugs = DOC_PAGES.map((p) => p.slug);
    assert.equal(new Set(slugs).size, slugs.length);
    for (const p of DOC_PAGES) {
      assert.match(p.slug, /^[a-z0-9-]+$/);
      assert.ok(p.title.length > 3 && p.description.length > 15 && p.blocks.length >= 2, p.slug);
      assert.ok(DOC_GROUPS.includes(p.group as never), `${p.slug} has unknown group`);
    }
  });

  test('heading ids are unique within a page', () => {
    for (const p of DOC_PAGES) {
      const ids = headingsOf(p).map((h) => h.id);
      assert.equal(new Set(ids).size, ids.length, p.slug);
    }
  });

  test('tables are rectangular', () => {
    for (const p of DOC_PAGES) {
      for (const b of p.blocks) {
        if (b.type === 'table') for (const r of b.rows) assert.equal(r.length, b.head.length, `${p.slug}: ${r[0]}`);
      }
    }
  });

  test('navigation covers every page once, in order', () => {
    const flat = pagesByGroup().flatMap((g) => g.pages.map((p) => p.slug));
    assert.equal(flat.length, DOC_PAGES.length);
    assert.equal(prevNext(DOC_PAGES[0].slug).prev, null);
    assert.equal(prevNext(DOC_PAGES[DOC_PAGES.length - 1].slug).next, null);
    assert.equal(prevNext(DOC_PAGES[1].slug).prev?.slug, DOC_PAGES[0].slug);
    assert.equal(findPage('nope'), undefined);
  });

  test('search finds pages by body text and needs every word', () => {
    assert.ok(searchDocs('grey-market premium').some((p) => p.slug === 'listing-gain-score'));
    assert.ok(searchDocs('50').some((p) => p.slug === 'nightly-run'));
    assert.deepEqual(searchDocs('   '), []);
    assert.deepEqual(searchDocs('zzzzqqq'), []);
  });

  test('slugify is stable', () => {
    assert.equal(slugifyHeading('The Run audit button'), 'the-run-audit-button');
  });

  test('numbers quoted in the docs match the code (daily cap, bands, caps)', () => {
    const text = JSON.stringify(DOC_PAGES);
    for (const fact of ['50 across all visitors', 'between 45 and 60', 'caps the score at 35', 'above 2.5', 'below 25%', '80 and above']) {
      assert.ok(text.includes(fact), `missing: ${fact}`);
    }
  });

  test('page order follows the navigation, so previous / next match the sidebar', () => {
    const flat = pagesByGroup().flatMap((g) => g.pages.map((p) => p.slug));
    assert.deepEqual(flat, DOC_PAGES.map((p) => p.slug));
  });

  test('every internal link points at a real page and every diagram is known', () => {
    for (const p of DOC_PAGES) {
      for (const b of p.blocks) {
        if (b.type === 'cards') for (const c of b.items) if (c.href) assert.ok(findPage(c.href.replace('/docs/', '')), `${p.slug}: ${c.href}`);
        if (b.type === 'diagram') assert.ok(DIAGRAM_NAMES.includes(b.name), `${p.slug}: ${b.name}`);
      }
    }
  });

  test('every diagram is used somewhere', () => {
    const used = new Set(DOC_PAGES.flatMap((p) => p.blocks.flatMap((b) => (b.type === 'diagram' ? [b.name] : []))));
    for (const d of DIAGRAM_NAMES) assert.ok(used.has(d), `unused diagram: ${d}`);
  });

  test('search reaches the new block types (glossary, faq, steps)', () => {
    assert.ok(searchDocs('Application Supported by Blocked Amount').some((p) => p.slug === 'glossary'));
    assert.ok(searchDocs('CRON_SECRET is not set').some((p) => p.slug === 'faq'));
    assert.ok(searchDocs('authenticator').some((p) => p.slug === 'quickstart'));
  });

  test('reading time is at least a minute', () => {
    for (const p of DOC_PAGES) assert.ok(readingMinutes(p) >= 1);
  });

  test('worked score example quotes the numbers the engine produces (see api tests/test_docs_examples.py)', () => {
    const text = JSON.stringify(findPage('score-walkthrough'));
    for (const fact of ['demand is their average, 95', 'maps to 66', '= 75.7', 'giving 71.7', 'Rounded: 72', 'cut to 44 + 15 = 59', '÷ 0.50 = 50']) {
      assert.ok(text.includes(fact), `missing: ${fact}`);
    }
  });
});
