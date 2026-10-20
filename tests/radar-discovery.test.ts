import test from 'node:test'
import assert from 'node:assert/strict'
import { advertisedRadarFeeds, discoverRadarFeeds } from '../server/radar-discovery'
import { parseRadarFeed } from '../server/radar-feed'

test('discovers advertised feeds, decodes attributes, deduplicates and ignores unsafe and inactive links', () => {
  const feeds = advertisedRadarFeeds(`
    <!-- <link rel="alternate" type="application/rss+xml" href="/comment"> -->
    <script>const x = '<link rel="alternate" type="application/rss+xml" href="/script">'</script>
    <LINK TYPE='application/rss+xml; charset=UTF-8' HREF='/feed?a=1&amp;b=2' REL='alternate' TITLE='News &amp; Updates'>
    <link rel="alternate" type="application/rss+xml" href="/feed?a=1&amp;b=2">
    <link rel="alternate" type="application/atom+xml" href="https://other.example/feed">
    <link rel="alternate" type="text/html" href="/article">
    <link rel="alternate" type="application/rss+xml" href="https://127.0.0.1/feed">
    <link rel="alternate" type="application/rss+xml" href="http://public.example/feed">
  `, 'https://news.example/section/')
  assert.deepEqual(feeds, [
    { title: 'News & Updates', url: 'https://news.example/feed?a=1&b=2' },
    { title: 'RSS-/Atom-Feed', url: 'https://other.example/feed' },
  ])
})

test('uses final response URL and accepts a direct feed', async () => {
  const result = await discoverRadarFeeds('https://news.example', async () => ({
    status: 200, body: '<link rel="alternate" type="application/rss+xml" href="feed">',
    url: 'https://news.example/redirected/', etag: null, modified: null,
  }))
  assert.equal(result.feeds[0].url, 'https://news.example/redirected/feed')
  const direct = await discoverRadarFeeds('https://news.example/rss', async () => ({
    status: 200, body: '<rss version="2.0"><channel><title>News</title></channel></rss>', etag: null, modified: null,
  }))
  assert.equal(direct.feeds[0].url, 'https://news.example/rss')
})

test('clear errors for HTML, missing feeds and HTTP errors; rejects unsafe input before request', async () => {
  assert.throws(() => parseRadarFeed('<!DOCTYPE html><html></html>', 'https://news.example'), /Website/)
  await assert.rejects(discoverRadarFeeds('https://news.example', async () => ({ status: 200, body: '<html>No feeds</html>', etag: null, modified: null })), /keine automatisch/)
  await assert.rejects(discoverRadarFeeds('https://news.example', async () => ({ status: 403, body: '', etag: null, modified: null })), /HTTP 403/)
  let called = false
  await assert.rejects(discoverRadarFeeds('https://127.0.0.1', async () => { called = true; throw Error('unexpected') }))
  assert.equal(called, false)
})
