// Post media smoke: classification, image galleries, embed providers (redgifs,
// youtube), and direct video resolution.
import {
    aspectRatioFromUrl,
    classifyPost,
    extractImageUrls,
    resolveVideoUrl,
    stripImageProxy,
} from '../src/services/post-media';
import { embedPosterFor, embedProviderForUrl, embedUrlFor } from '../src/services/embeds';
import { assert, makePost } from './smoke-helpers';

// ---- post-media classification ----

export function runPostMediaTests(): void {
    assert(
        classifyPost(makePost({ postType: 'Image', url: 'https://x/img.jpeg' })) === 'image',
        'piefed image type classifies image',
    );
    assert(
        classifyPost(makePost({ postType: 'Video', url: 'https://x/vid.mp4' })) === 'video',
        'piefed video type classifies video',
    );
    assert(classifyPost(makePost({ postType: 'Discussion', body: 'hi' })) === 'text', 'discussion classifies text');
    assert(
        classifyPost(makePost({ postType: 'Link', url: 'https://x/article' })) === 'link',
        'link with plain url classifies link',
    );
    assert(
        classifyPost(makePost({ url: 'https://lemmy.ml/api/v3/image_proxy?url=https%3A%2F%2Fx%2Fpic.png' })) ===
            'image',
        'image_proxy url decodes to image',
    );
    assert(classifyPost(makePost({ url: 'https://x/movie.webm' })) === 'video', 'webm url classifies video');
    assert(
        classifyPost(makePost({ url: 'https://x/a.jpeg?w=100' })) === 'image',
        'query-string extension classifies image',
    );
    assert(classifyPost(makePost({ body: 'just text' })) === 'text', 'body-only post classifies text');

    assert(
        stripImageProxy('https://x/api/v3/image_proxy?url=https%3A%2F%2Freal.example%2Fpic.jpeg') ===
            'https://real.example/pic.jpeg',
        'image_proxy decodes',
    );
    assert(stripImageProxy('https://x/plain.jpeg') === 'https://x/plain.jpeg', 'non-proxy url unchanged');

    const gallery = makePost({
        url: 'https://x/main.png',
        body: 'see ![one](https://x/one.png) and ![two](https://x/two.webp) plus ![main](https://x/main.png)',
    });
    const galleryUrls = extractImageUrls(gallery);
    assert(galleryUrls.length === 3, 'primary + body images collected');
    assert(
        galleryUrls[0] === 'https://x/main.png' && galleryUrls.includes('https://x/one.png'),
        'gallery order and dedupe',
    );
    assert(
        extractImageUrls(makePost({ body: '![link](https://x/doc.pdf)' })).length === 0,
        'non-image body links ignored',
    );
    assert(aspectRatioFromUrl('https://x/foo_1280x720.png') === 16 / 9, 'pictrs aspect ratio parsed');
}

// ---- embed providers (redgifs, youtube) ----

export function runEmbedProviderTests(): void {
    assert(
        embedProviderForUrl('https://www.redgifs.com/watch/steeldeadlyitaliangreyhound')?.name === 'redgifs',
        'redgifs watch provider',
    );
    assert(embedProviderForUrl('https://redgifs.com/ifr/abc123')?.name === 'redgifs', 'redgifs ifr provider');
    assert(
        embedProviderForUrl('https://media.redgifs.com/SteelDeadlyItaliangreyhound-mobile.mp4') === null,
        'media file is not a page id',
    );
    assert(embedProviderForUrl('https://example.com/watch/xyz') === null, 'non-redgifs url rejected');
    assert(embedUrlFor('https://x.com/v.mp4') === null, 'no embed for direct file');
    assert(
        embedProviderForUrl('https://www.youtube.com/watch?v=dQw4w9WgXcQ')?.name === 'youtube',
        'youtube watch provider',
    );
    assert(embedProviderForUrl('https://youtu.be/dQw4w9WgXcQ')?.name === 'youtube', 'youtu.be provider');
    assert(
        embedProviderForUrl('https://example.com/watch?v=dQw4w9WgXcQ') === null,
        'non-youtube host with watch param rejected',
    );

    assert(
        classifyPost(
            makePost({ postType: 'Link', url: 'https://www.redgifs.com/watch/steeldeadlyitaliangreyhound' }),
        ) === 'video',
        'lemmy redgifs link classifies video',
    );
    assert(
        classifyPost(makePost({ url: 'https://redgifs.com/watch/abc' })) === 'video',
        'untyped redgifs url classifies video',
    );
    assert(
        classifyPost(makePost({ postType: 'Link', url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ' })) === 'video',
        'lemmy youtube link classifies video',
    );
    assert(
        classifyPost(makePost({ url: 'https://youtu.be/dQw4w9WgXcQ' })) === 'video',
        'untyped youtube url classifies video',
    );

    const direct = resolveVideoUrl('https://x.com/video.mp4');
    assert(
        direct.src === 'https://x.com/video.mp4' && direct.poster === null && direct.candidates.length === 0,
        'direct video passes through',
    );
    const unsafeVideo = resolveVideoUrl('javascript:alert(1)');
    assert(unsafeVideo.src === null, 'unsafe direct video url rejected');

    // embed sites play through the official embed player, not a <video> element
    assert(
        embedUrlFor('https://www.redgifs.com/watch/steeldeadlyitaliangreyhound') ===
            'https://www.redgifs.com/ifr/steeldeadlyitaliangreyhound',
        'redgifs watch url maps to the embed player',
    );
    assert(
        embedUrlFor('https://redgifs.com/ifr/abc123') === 'https://www.redgifs.com/ifr/abc123',
        'redgifs ifr url maps to the embed player',
    );
    assert(embedUrlFor('https://media.redgifs.com/x-mobile.mp4') === null, 'media file gets no embed');
    assert(embedUrlFor('https://example.com/v.mp4') === null, 'non-redgifs url gets no embed');
    assert(embedUrlFor('javascript:alert(1)') === null, 'unsafe url gets no embed');
    assert(
        resolveVideoUrl('https://www.redgifs.com/watch/steeldeadlyitaliangreyhound').src === null,
        'resolveVideoUrl leaves redgifs to the embed player',
    );
}

// ---- youtube embeds ----

export function runYoutubeEmbedTests(): void {
    assert(
        embedUrlFor('https://www.youtube.com/watch?v=dQw4w9WgXcQ') ===
            'https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ',
        'youtube watch url maps to nocookie embed',
    );
    assert(
        embedUrlFor('https://youtu.be/dQw4w9WgXcQ') === 'https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ',
        'youtu.be url maps to nocookie embed',
    );
    assert(
        embedUrlFor('https://www.youtube.com/shorts/dQw4w9WgXcQ') ===
            'https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ',
        'youtube shorts url maps to nocookie embed',
    );
    assert(
        embedUrlFor('https://www.youtube.com/embed/dQw4w9WgXcQ') ===
            'https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ',
        'youtube embed url maps to nocookie embed',
    );
    assert(
        embedUrlFor('https://www.youtube.com/live/dQw4w9WgXcQ') ===
            'https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ',
        'youtube live url maps to nocookie embed',
    );
    assert(
        embedUrlFor('https://m.youtube.com/watch?v=dQw4w9WgXcQ') ===
            'https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ',
        'mobile youtube host maps to nocookie embed',
    );
    assert(
        embedUrlFor('https://music.youtube.com/watch?v=dQw4w9WgXcQ') ===
            'https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ',
        'music youtube host maps to nocookie embed',
    );
    assert(
        embedUrlFor('https://www.youtube.com/watch?v=dQw4w9WgXcQ&list=PL123') ===
            'https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ',
        'playlist param ignored',
    );
    assert(embedUrlFor('https://www.youtube.com/watch?v=short') === null, 'too-short youtube id rejected');
    assert(embedUrlFor('https://notyoutube.com/watch?v=dQw4w9WgXcQ') === null, 'lookalike youtube host rejected');
    assert(embedUrlFor('javascript:alert(1)') === null, 'unsafe youtube url rejected');
    assert(
        resolveVideoUrl('https://www.youtube.com/watch?v=dQw4w9WgXcQ').src === null,
        'resolveVideoUrl leaves youtube to the embed player',
    );
    assert(
        embedProviderForUrl('https://www.youtube.com/watch?v=dQw4w9WgXcQ')?.iframeReferrerPolicy ===
            'strict-origin-when-cross-origin',
        'youtube iframe sends origin so the player can configure',
    );
    assert(
        embedProviderForUrl('https://www.redgifs.com/watch/xyz')?.iframeReferrerPolicy === undefined,
        'redgifs iframe keeps the no-referrer default',
    );

    assert(
        embedPosterFor('https://www.youtube.com/watch?v=dQw4w9WgXcQ') ===
            'https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg',
        'youtube placeholder poster from thumbnail feed',
    );
    assert(
        embedPosterFor('https://www.redgifs.com/watch/steeldeadlyitaliangreyhound') === null,
        'redgifs has no placeholder poster',
    );
}
