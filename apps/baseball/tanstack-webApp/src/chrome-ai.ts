// Chrome Built-in AI (Prompt API / window.ai) TypeScript interface declarations

declare global {
  interface Window {
    ai?: {
      languageModel?: {
        capabilities(): Promise<{
          available: 'readily' | 'after-download' | 'no';
          defaultTemperature: number;
          maxTemperature: number;
          defaultTopK: number;
          maxTopK: number;
        }>;
        create(options?: {
          systemPrompt?: string;
          temperature?: number;
          topK?: number;
        }): Promise<ChromeAiSession>;
      };
    };
  }
}

export interface ChromeAiSession {
  prompt(input: string): Promise<string>;
  promptStreaming(input: string): AsyncIterable<string>;
  destroy(): void;
}

export interface Article {
  id: number;
  title: string;
  summary: string;
  category: string;
  tags: string[];
  isStarred?: boolean;
}

export const sampleArticles: Article[] = [
  {
    id: 1,
    title: 'The Evolution of Sabermetrics in Modern Baseball',
    summary: 'How advanced statistical metrics like wRC+ and WAR revolutionized front office decisions.',
    category: 'Analytics',
    tags: ['Sabermetrics', 'WAR', 'Analytics', 'Front Office'],
  },
  {
    id: 2,
    title: 'Pitching Velocity vs. Pitch Design: What Wins Games?',
    summary: 'Analyzing spin rate, seam-shifted wake, and velocity trends across MLB starting pitchers.',
    category: 'Pitching',
    tags: ['Pitching', 'Spin Rate', 'Velocity', 'Mechanics'],
  },
  {
    id: 3,
    title: 'Top 10 Prospect Breakthroughs of the Season',
    summary: 'A deep dive into emerging minor league talent making waves before their big league call-ups.',
    category: 'Prospects',
    tags: ['Prospects', 'Minor League', 'Rookies', 'Development'],
  },
  {
    id: 4,
    title: 'Defensive Positioning Strategies in the Post-Shift Era',
    summary: 'How infield coordinators adapt alignment strategies following MLB rule changes.',
    category: 'Strategy',
    tags: ['Defense', 'Positioning', 'Rules', 'Strategy'],
  },
  {
    id: 5,
    title: 'Clutch Hitting: Myth or Measurable Skill?',
    summary: 'Examining Win Probability Added (WPA) and high-leverage plate appearances.',
    category: 'Analytics',
    tags: ['Clutch', 'WPA', 'Sabermetrics', 'Batting'],
  },
];

export async function isChromeAiAvailable(): Promise<boolean> {
  if (typeof window === 'undefined' || !window.ai?.languageModel) {
    return false;
  }
  try {
    const caps = await window.ai.languageModel.capabilities();
    return caps.available !== 'no';
  } catch {
    return false;
  }
}

export async function predictRecommendedArticles(
  starredArticles: Article[],
  allArticles: Article[]
): Promise<{ recommendations: Article[]; aiReasoning: string }> {
  const unstarred = allArticles.filter((a) => !starredArticles.some((s) => s.id === a.id));
  if (starredArticles.length === 0 || unstarred.length === 0) {
    return {
      recommendations: unstarred,
      aiReasoning: 'Star some articles to receive AI-powered personalized recommendations.',
    };
  }

  const aiAvailable = await isChromeAiAvailable();

  if (aiAvailable && window.ai?.languageModel) {
    try {
      const session = await window.ai.languageModel.create({
        systemPrompt:
          'You are a sports analytics AI assistant. Analyze user article preferences based on tags/categories and recommend similar unread articles.',
      });

      const promptText = `User liked these articles:
${starredArticles.map((a) => `- ${a.title} (Category: ${a.category}, Tags: ${a.tags.join(', ')})`).join('\n')}

Candidate articles:
${unstarred.map((a) => `[ID ${a.id}] ${a.title} (Category: ${a.category}, Tags: ${a.tags.join(', ')})`).join('\n')}

Please return candidate IDs in order of preference and explain why.`;

      const response = await session.prompt(promptText);
      session.destroy();

      return {
        recommendations: unstarred,
        aiReasoning: response,
      };
    } catch (e) {
      console.warn('Chrome AI invocation fallback:', e);
    }
  }

  // Heuristic Fallback matching common tags/categories if Chrome AI prompt API is downloading or unavailable
  const starredTags = new Set(starredArticles.flatMap((a) => a.tags));
  const starredCategories = new Set(starredArticles.map((a) => a.category));

  const scored = unstarred.map((article) => {
    let score = 0;
    if (starredCategories.has(article.category)) score += 3;
    article.tags.forEach((tag) => {
      if (starredTags.has(tag)) score += 2;
    });
    return { article, score };
  });

  scored.sort((a, b) => b.score - a.score);

  return {
    recommendations: scored.map((s) => s.article),
    aiReasoning: `Local heuristic recommendation based on matching tags (${Array.from(starredTags).join(', ')}) and categories (${Array.from(starredCategories).join(', ')}).`,
  };
}
