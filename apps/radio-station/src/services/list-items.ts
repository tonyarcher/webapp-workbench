import type {DayFilter, ListItem, PlaylistEntry} from '../types';
import {dayLabel, hourLabel, localDayKey, localHourKey} from './format';

export function filterEntries(entries: PlaylistEntry[], day: DayFilter): PlaylistEntry[] {
    if (day === 'all') return entries;
    return entries.filter((entry) => localDayKey(entry.startsAt) === day);
}

export function weekDays(entries: PlaylistEntry[]): {key: string; label: string}[] {
    const seen = new Map<string, string>();
    for (const entry of entries) {
        const key = localDayKey(entry.startsAt);
        if (!seen.has(key)) seen.set(key, dayLabel(entry.startsAt));
    }
    return [...seen].map(([key, label]) => ({key, label}));
}

export function toListItems(entries: PlaylistEntry[], day: DayFilter): ListItem[] {
    const items: ListItem[] = [];
    let lastDay = '';
    let lastHour = '';
    for (const entry of filterEntries(entries, day)) {
        const dayKey = localDayKey(entry.startsAt);
        const hourKey = localHourKey(entry.startsAt);
        if (dayKey !== lastDay) {
            items.push({kind: 'day', key: `day-${dayKey}`, label: dayLabel(entry.startsAt), day: dayKey});
            lastDay = dayKey;
            lastHour = '';
        }
        if (hourKey !== lastHour) {
            items.push({kind: 'hour', key: `hour-${hourKey}`, label: hourLabel(entry.startsAt)});
            lastHour = hourKey;
        }
        items.push({kind: 'track', key: `track-${entry.idx}`, entry});
    }
    return items;
}

export function trackIndexOf(items: ListItem[], trackId: string, startsAt: number): number {
    return items.findIndex(
        (item) => item.kind === 'track' && item.entry.trackId === trackId && item.entry.startsAt === startsAt,
    );
}
