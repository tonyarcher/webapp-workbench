import type {Track} from './types.js';

function id(n: number): string {
    return `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
}

function ms(min: number, sec: number): number {
    return (min * 60 + sec) * 1_000;
}

function track(
    n: number,
    artist: string,
    title: string,
    durationMs: number,
    year: number,
    era: Track['era'],
    rotation: Track['rotation'],
    rank: number,
): Track {
    return {
        id: id(n),
        artist,
        title,
        durationMs,
        year,
        genre: 'pop',
        era,
        rotation,
        rank,
        explicit: false,
        radioEdit: true,
    };
}

/** Invented CHR library. Real titles wait for a later MusicBrainz ingest. */
export const PLACEHOLDER_TRACKS: Track[] = [
    track(1, 'The Chartliners', 'Neon Boulevard', ms(3, 28), 2025, 'current', 'power', 1),
    track(2, 'Luna Vox', 'Midnight Static', ms(3, 12), 2025, 'current', 'power', 2),
    track(3, 'Ivy Lane', 'Glass Heart Radio', ms(3, 41), 2024, 'current', 'power', 3),
    track(4, 'The Afterglow', 'Summer Frequency', ms(3, 5), 2025, 'current', 'power', 4),
    track(5, 'MAXLINE', 'Chrome Skyline', ms(2, 58), 2025, 'current', 'power', 5),
    track(6, 'Sable Quinn', "Don't Call It Love", ms(3, 33), 2024, 'current', 'power', 6),
    track(7, 'KIRRA', 'Velvet Voltage', ms(3, 19), 2025, 'current', 'power', 7),
    track(8, 'The Late Arrivals', 'One More Chorus', ms(3, 47), 2024, 'current', 'power', 8),

    track(9, 'Aria North', 'Pink Hour', ms(3, 8), 2025, 'current', 'current', 1),
    track(10, 'Jett Marlowe', 'Run the Lights', ms(2, 51), 2024, 'current', 'current', 2),
    track(11, 'Nova Hale', 'Paper Crown', ms(3, 22), 2025, 'current', 'current', 3),
    track(12, 'The Weekend Kids', 'Hotel Lobby', ms(3, 14), 2024, 'current', 'current', 4),
    track(13, 'Mira Sol', 'Low Battery Heart', ms(3, 36), 2025, 'current', 'current', 5),
    track(14, 'Dash & Echo', 'Talk in Color', ms(2, 47), 2024, 'current', 'current', 6),
    track(15, 'PENNYROW', 'Satellite Crush', ms(3, 9), 2025, 'current', 'current', 7),
    track(16, 'Owen Park', 'Left on Read', ms(3, 27), 2024, 'current', 'current', 8),
    track(17, 'Yara Bloom', 'Soft Launch', ms(3, 1), 2025, 'current', 'current', 9),
    track(18, 'The Glowsticks', 'Friday Chemistry', ms(3, 18), 2024, 'current', 'current', 10),
    track(19, 'Nico Vale', 'Blue Hour Text', ms(3, 44), 2025, 'current', 'current', 11),
    track(20, 'HALO WAVE', 'Glitter Mileage', ms(2, 54), 2024, 'current', 'current', 12),
    track(21, 'Tess Orion', 'Borrow My Jacket', ms(3, 31), 2025, 'current', 'current', 13),
    track(22, 'The Marquee', 'Last Train Home', ms(3, 16), 2024, 'current', 'current', 14),
    track(23, 'Cal Vesper', 'Cheap Sunglasses', ms(3, 4), 2025, 'current', 'current', 15),
    track(24, 'Luna Vox', 'Replay Button', ms(3, 21), 2024, 'current', 'current', 16),

    track(25, 'River Glen', 'Still the One', ms(3, 38), 2023, 'recurrent', 'recurrent', 1),
    track(26, 'The Nightshift', 'Afterparty Eyes', ms(3, 11), 2022, 'recurrent', 'recurrent', 2),
    track(27, 'Wren Cassidy', 'Hometown Glow', ms(3, 29), 2023, 'recurrent', 'recurrent', 3),
    track(28, 'SOLSTICE', 'Heatwave Radio', ms(3, 7), 2021, 'recurrent', 'recurrent', 4),
    track(29, 'June Harbor', 'Two Left Turns', ms(3, 42), 2022, 'recurrent', 'recurrent', 5),
    track(30, 'The Postcard Band', 'Drive-Thru Lights', ms(3, 15), 2023, 'recurrent', 'recurrent', 6),
    track(31, 'Ellis Quinn', 'Never Not You', ms(3, 26), 2021, 'recurrent', 'recurrent', 7),
    track(32, 'MAGNETA', 'Cherry Dash', ms(2, 59), 2022, 'recurrent', 'recurrent', 8),
    track(33, 'Piper Lane', 'Backseat Anthem', ms(3, 34), 2023, 'recurrent', 'recurrent', 9),
    track(34, 'The Skyline Club', 'Rooftop Weather', ms(3, 20), 2021, 'recurrent', 'recurrent', 10),
    track(35, 'Dane Hollow', 'Slow Motion Summer', ms(3, 48), 2022, 'recurrent', 'recurrent', 11),
    track(36, 'KIRRA', 'Echo in the Mix', ms(3, 13), 2023, 'recurrent', 'recurrent', 12),

    track(37, 'STARLIT', 'Disco Fire Escape', ms(3, 45), 2008, 'gold-2000s', 'gold', 1),
    track(38, 'The Neon Youth', 'Camera Flash', ms(3, 18), 2004, 'gold-2000s', 'gold', 2),
    track(39, 'Mila Day', 'Lip Gloss Monday', ms(3, 6), 2007, 'gold-2000s', 'gold', 3),
    track(40, 'CRASHWAVE', 'Clubhouse Lights', ms(3, 32), 2005, 'gold-2000s', 'gold', 4),
    track(41, 'Harper Flynn', 'Text Me Maybe Not', ms(3, 24), 2009, 'gold-2000s', 'gold', 5),
    track(42, 'The Mallrats', 'Food Court Love', ms(3, 10), 2003, 'gold-2000s', 'gold', 6),
    track(43, 'Violet Rush', 'Glitterball', ms(3, 39), 2006, 'gold-2000s', 'gold', 7),
    track(44, 'TONIC POP', 'Ringtone Heart', ms(2, 56), 2008, 'gold-2000s', 'gold', 8),
    track(45, 'The Afterparty', 'Sunset Strip', ms(3, 27), 2002, 'gold-2000s', 'gold', 9),
    track(46, 'Gina Sparks', 'Cheer Captain', ms(3, 14), 2009, 'gold-2000s', 'gold', 10),
    track(47, 'PIXEL HEARTS', 'MySpace Summer', ms(3, 35), 2006, 'gold-2000s', 'gold', 11),
    track(48, 'The Downtown Kids', 'Skatepark Radio', ms(3, 9), 2004, 'gold-2000s', 'gold', 12),

    track(49, 'The Dialtones', 'Payphone Serenade', ms(3, 52), 1998, 'gold-1990s', 'gold', 1),
    track(50, 'Candy Stereo', 'Mall Directory', ms(3, 17), 1996, 'gold-1990s', 'gold', 2),
    track(51, 'BROADCAST 9', 'Friday Night Mix', ms(4, 2), 1994, 'gold-1990s', 'gold', 3),
    track(52, 'The Walkmans', 'Mix Tape Side B', ms(3, 29), 1997, 'gold-1990s', 'gold', 4),
    track(53, 'Lola Fizz', 'Bubblegum Orbit', ms(3, 8), 1999, 'gold-1990s', 'gold', 5),
    track(54, 'HIGH VOLTAGE POP', 'Roller Rink', ms(3, 41), 1995, 'gold-1990s', 'gold', 6),
    track(55, 'The Yearbook', 'Prom Night Static', ms(3, 23), 1993, 'gold-1990s', 'gold', 7),
    track(56, 'Aqua Marine', 'Waterpark Hit', ms(3, 15), 1998, 'gold-1990s', 'gold', 8),
];

export const STATION_ID = 'top40';
export const STATION_NAME = 'Pulse 101';
export const STATION_FORMAT = 'Top 40';
