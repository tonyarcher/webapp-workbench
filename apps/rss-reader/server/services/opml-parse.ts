import {DOMParser} from 'linkedom';
import type {OpmlNode} from '../types.js';

function parseOpmlNode(outline: Element): OpmlNode {
    const xmlUrl = outline.getAttribute('xmlUrl');
    const outlineChildren = (Array.from(outline.children) as Element[]).filter(
        (c) => c.tagName?.toLowerCase() === 'outline',
    );

    if (xmlUrl || outlineChildren.length === 0) {
        return {
            title: outline.getAttribute('title') || outline.getAttribute('text') || 'Untitled',
            xmlUrl: xmlUrl ?? '',
            htmlUrl: outline.getAttribute('htmlUrl') || undefined,
        };
    }

    return {
        title: outline.getAttribute('title') || outline.getAttribute('text') || 'Untitled',
        children: outlineChildren.map(parseOpmlNode),
    };
}

export function parseOpml(xml: string): OpmlNode[] {
    const doc = new DOMParser().parseFromString(xml, 'text/xml') as unknown as Document;
    if (doc.getElementsByTagName('parsererror').length > 0) throw new Error('Could not parse OPML');
    const body = doc.getElementsByTagName('body')[0] ?? doc.documentElement;
    return (Array.from(body.children) as Element[])
        .filter((c) => c.tagName?.toLowerCase() === 'outline')
        .map(parseOpmlNode);
}

export function isFolder(node: OpmlNode): node is OpmlNode & { children: OpmlNode[] } {
    return 'children' in node;
}

export function collectSources(nodes: OpmlNode[]): Array<{ title: string; xmlUrl: string; htmlUrl?: string }> {
    const out: Array<{ title: string; xmlUrl: string; htmlUrl?: string }> = [];
    const walk = (n: OpmlNode) => {
        if (isFolder(n)) n.children.forEach(walk);
        else if (n.xmlUrl) out.push(n);
    };
    nodes.forEach(walk);
    return out;
}
