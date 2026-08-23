// vertical-scroll-core registers its custom elements at import time; Node has
// no DOM, so stub the bare minimum globals before importing the package.
class StubHTMLElement {}
Object.defineProperty(globalThis, 'HTMLElement', {value: StubHTMLElement, configurable: true})
Object.defineProperty(globalThis, 'customElements', {value: {define: () => {}}, configurable: true})
Object.defineProperty(globalThis, 'document', {
    value: {
        createComment: () => ({}),
        createTreeWalker: () => null,
    },
    configurable: true,
})

const {classifyScrollItem} = await import('vertical-scroll-core')
const {parseLinkList} = await import('../src/services/parse-list')
const {toScrollItem} = await import('../src/services/to-scroll-item')
const {parseSession, serializeSession} = await import('../src/services/session-store')

function assert(cond: unknown, msg: string): void {
    if (!cond) throw new Error(`FAIL: ${msg}`)
}

// one URL per line (two playable)
{
    const r = parseLinkList('https://www.tiktok.com/@a/video/111111\nhttps://www.tiktok.com/@b/video/222222')
    assert(r.items.length === 2, 'two playable per line')
    assert(r.items[0].id === '111111', 'first id')
    assert(r.items[1].id === '222222', 'second id')
}

// URL buried in junk text
{
    const r = parseLinkList('Check this out: https://www.tiktok.com/@a/video/333333 — so good!')
    assert(r.items.length === 1, 'buried url parsed')
    assert(r.items[0].id === '333333', 'buried url id')
}

// CSV with header url,title and a url column
{
    const r = parseLinkList('url,title\nhttps://www.tiktok.com/@a/video/444444,My video')
    assert(r.items.length === 1, 'csv url column parsed')
    assert(r.items[0].id === '444444', 'csv url column id')
}

// quoted CSV field
{
    const r = parseLinkList('"https://www.tiktok.com/@a/video/555555",other"')
    assert(r.items.length === 1, 'quoted csv field parsed')
    assert(r.items[0].id === '555555', 'quoted csv field id')
}

// @user/video/{id} extracts author + id
{
    const r = parseLinkList('https://www.tiktok.com/@cooluser/video/666666')
    assert(r.items.length === 1, 'author video parsed')
    assert(r.items[0].id === '666666', 'author video id')
    assert(r.items[0].author === 'cooluser', 'author extracted')
}

// m.tiktok.com/v/{id}.html
{
    const r = parseLinkList('https://m.tiktok.com/v/777777.html')
    assert(r.items.length === 1, 'mobile v parsed')
    assert(r.items[0].id === '777777', 'mobile v id')
}

// tiktok.com/embed/v2/{id}
{
    const r = parseLinkList('https://www.tiktok.com/embed/v2/888888')
    assert(r.items.length === 1, 'embed v2 parsed')
    assert(r.items[0].id === '888888', 'embed v2 id')
}

// tiktok.com/player/v1/{id}
{
    const r = parseLinkList('https://www.tiktok.com/player/v1/999999')
    assert(r.items.length === 1, 'player v1 parsed')
    assert(r.items[0].id === '999999', 'player v1 id')
}

// query-string junk on a video URL still extracts id
{
    const r = parseLinkList('https://www.tiktok.com/@a/video/101010?lang=en&share_token=abc')
    assert(r.items.length === 1, 'query junk parsed')
    assert(r.items[0].id === '101010', 'query junk id')
}

// short links skipped
{
    const r = parseLinkList('https://vm.tiktok.com/ZMxxxx/\nhttps://vt.tiktok.com/ZSxxxx/\nhttps://www.tiktok.com/t/ZTxxxx/')
    assert(r.items.length === 0, 'short links not playable')
    assert(r.skipped.length === 3, 'three short links skipped')
    assert(r.skipped.every((s) => s.reason === 'short-link'), 'short-link reasons')
}

// photo post skipped no-id
{
    const r = parseLinkList('https://www.tiktok.com/@user/photo/123')
    assert(r.items.length === 0, 'photo not playable')
    assert(r.skipped.length === 1, 'photo skipped')
    assert(r.skipped[0].reason === 'no-id', 'photo reason no-id')
}

// non-tiktok skipped
{
    const r = parseLinkList('https://example.com/x')
    assert(r.items.length === 0, 'non-tiktok not playable')
    assert(r.skipped.length === 1, 'non-tiktok skipped')
    assert(r.skipped[0].reason === 'unsupported', 'unsupported host reason')
}

// duplicate video id kept once (first)
{
    const r = parseLinkList('https://www.tiktok.com/@a/video/121212\nhttps://www.tiktok.com/@b/video/121212')
    assert(r.items.length === 1, 'duplicate id deduped')
    assert(r.items[0].author === 'a', 'first author kept')
}

// order preserved
{
    const r = parseLinkList(
        'https://www.tiktok.com/@a/video/131313\nhttps://www.tiktok.com/@b/video/141414\nhttps://www.tiktok.com/@c/video/151515',
    )
    assert(r.items.map((i) => i.id).join(',') === '131313,141414,151515', 'order preserved')
}

// empty string → empty
{
    const r = parseLinkList('')
    assert(r.items.length === 0, 'empty items')
    assert(r.skipped.length === 0, 'empty skipped')
}

// trailing punctuation still parses
{
    const r = parseLinkList('https://www.tiktok.com/@u/video/161616,')
    assert(r.items.length === 1, 'trailing comma parsed')
    assert(r.items[0].id === '161616', 'trailing comma id')
}

// official data-export Like List (tiktokv.com/share/video/{id} + Date: line)
{
    const r = parseLinkList(
        'Date: 2026-06-07 01:25:56 UTC\nLink: https://www.tiktokv.com/share/video/7450092027154566446/\n\nDate: 2026-06-07 00:57:49 UTC\nLink: https://www.tiktokv.com/share/video/7454316961237978411/',
    )
    assert(r.items.length === 2, 'export two playable')
    assert(r.skipped.length === 0, 'export none skipped')
    assert(r.items[0].id === '7450092027154566446', 'export first id')
    assert(r.items[0].url === 'https://www.tiktokv.com/share/video/7450092027154566446/', 'export keeps share url')
    assert(r.items[0].date === '2026-06-07 01:25:56 UTC', 'export date attached')
    assert(r.items[1].id === '7454316961237978411', 'export second id')
    assert(r.items[1].date === '2026-06-07 00:57:49 UTC', 'export second date')
}

// Date: before a skipped short-link must not stamp the next playable item
{
    const r = parseLinkList(
        'Date: 2026-01-01 00:00:00 UTC\nLink: https://vm.tiktok.com/ZMxxxx/\nLink: https://www.tiktok.com/@a/video/123456',
    )
    assert(r.items.length === 1, 'short-link then playable')
    assert(r.skipped.length === 1 && r.skipped[0].reason === 'short-link', 'short-link skipped')
    assert(r.items[0].date === undefined, 'date consumed by skipped link')
}

// bare tiktokv share url (no Date line) still kept
{
    const r = parseLinkList('https://www.tiktokv.com/share/video/7648217925408607502/')
    assert(r.items.length === 1, 'bare share playable')
    assert(r.items[0].url === 'https://www.tiktokv.com/share/video/7648217925408607502/', 'bare share kept')
}

// Instagram reel + /p/ + nested user path
{
    const r = parseLinkList(
        'https://www.instagram.com/reel/CxYz123AbCd/\nhttps://www.instagram.com/p/AbCdEfGhIjK/\nhttps://www.instagram.com/someone/reel/LmNoPqRsTuV/',
    )
    assert(r.items.length === 3, 'three instagram playable')
    assert(r.items[0].provider === 'instagram' && r.items[0].id === 'CxYz123AbCd', 'reel id')
    assert(r.items[1].provider === 'instagram' && r.items[1].id === 'AbCdEfGhIjK', 'p id')
    assert(r.items[2].author === 'someone' && r.items[2].id === 'LmNoPqRsTuV', 'user/reel author')
}

// mixed TikTok + Instagram list
{
    const r = parseLinkList(
        'https://www.tiktok.com/@a/video/202020\nhttps://www.instagram.com/reel/MixEdClip01/',
    )
    assert(r.items.length === 2, 'mixed list length')
    assert(r.items[0].provider === 'tiktok' && r.items[1].provider === 'instagram', 'mixed providers')
}

// Instagram short links skipped
{
    const r = parseLinkList('https://l.instagram.com/foo\nhttps://www.instagram.com/share/reel/xxxx/')
    assert(r.items.length === 0, 'ig short links not playable')
    assert(r.skipped.length === 2 && r.skipped.every((s) => s.reason === 'short-link'), 'ig short-link reasons')
}

// Instagram JSON export href blob
{
    const r = parseLinkList('{"saved_saved_media":[{"string_list_data":[{"href":"https://www.instagram.com/reel/JsonCode01/"}]}]}')
    assert(r.items.length === 1, 'json href parsed')
    assert(r.items[0].id === 'JsonCode01', 'json href id')
}

// Date: still stamps the next Instagram URL
{
    const r = parseLinkList('Date: 2026-03-01 12:00:00 UTC\nhttps://www.instagram.com/reel/DateStamp1/')
    assert(r.items[0]?.date === '2026-03-01 12:00:00 UTC', 'ig date attached')
}

// toScrollItem mapping + classification
{
    const item = toScrollItem({id: '171717', url: 'https://www.tiktok.com/@u/video/171717', author: 'u'}, 0, 3)
    assert(item.videoUrl === 'https://www.tiktok.com/@u/video/171717', 'videoUrl set')
    assert(item.mediaType === 'Video', 'mediaType Video')
    assert(item.metaLine === '1 of 3', 'metaLine')
    assert(classifyScrollItem(item) === 'video', 'classifies as video')
}

{
    const ig = toScrollItem(
        {id: 'CxYz123AbCd', url: 'https://www.instagram.com/reel/CxYz123AbCd/', provider: 'instagram'},
        0,
        1,
    )
    assert(classifyScrollItem(ig) === 'video', 'instagram classifies as video')
}

// no-author title fallback
{
    const item = toScrollItem({id: '181818', url: 'https://www.tiktok.com/v/181818'}, 1, 2)
    assert(item.title === '', 'no-author title stays empty until oembed')
}

// export date lands in metaLine
{
    const item = toScrollItem(
        {id: '191919', url: 'https://www.tiktokv.com/share/video/191919/', date: '2026-06-07 01:25:56 UTC'},
        0,
        1,
    )
    assert(item.metaLine === '1 of 1 · 2026-06-07 01:25:56 UTC', 'date in metaLine')
    assert(item.originalUrl === 'https://www.tiktokv.com/share/video/191919/', 'original is share url')
}

// oEmbed pageUrl wins for Open original
{
    const item = toScrollItem(
        {
            id: '7463395292222672170',
            url: 'https://www.tiktokv.com/share/video/7463395292222672170/',
            pageUrl: 'https://www.tiktok.com/@ufo.phenom/video/7463395292222672170',
            author: 'ufo.phenom',
        },
        0,
        1,
    )
    assert(item.originalUrl === 'https://www.tiktok.com/@ufo.phenom/video/7463395292222672170', 'pageUrl for original')
    assert(item.title === '@ufo.phenom', 'author title')
    assert(item.author === 'ufo.phenom', 'author field set')
}

// oembed caption is title
{
    const item = toScrollItem(
        {
            id: '202020',
            url: 'https://www.tiktok.com/@u/video/202020',
            author: 'u',
            title: 'a funny clip',
        },
        0,
        1,
    )
    assert(item.title === 'a funny clip', 'oembed caption is title')
    assert(item.author === 'u', 'author field set')
}

// session persist / restore
{
    const session = {
        version: 1 as const,
        items: [{id: '1', url: 'https://www.tiktokv.com/share/video/1/', date: '2026-01-01', thumbnailUrl: 'https://example.com/t.jpg'}],
        skipped: [{url: 'https://vm.tiktok.com/x/', reason: 'short-link' as const}],
        activeIndex: 12,
        maxSeen: 20,
    }
    const roundTrip = parseSession(serializeSession(session))
    assert(roundTrip !== null, 'session parses')
    assert(roundTrip?.items[0].id === '1', 'session item id')
    assert(roundTrip?.items[0].date === '2026-01-01', 'session date kept')
    assert(roundTrip?.items[0].thumbnailUrl === 'https://example.com/t.jpg', 'thumbnail kept')
    assert(roundTrip?.activeIndex === 12, 'session index')
    assert(roundTrip?.skipped[0].reason === 'short-link', 'session skipped')
    assert(parseSession(null) === null, 'empty session')
    assert(parseSession('{') === null, 'corrupt session')
    assert(parseSession('{"version":1,"items":[]}') === null, 'empty items rejected')
}

console.log('smoke.ts: all assertions passed')

export {}