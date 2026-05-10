const GITHUB_API_URL = 'https://api.github.com/gists';
const FILENAME = 'museum-data.json';
const DESCRIPTION = 'Museum Portfolio Timeline Backup';

type GistSummary = {
  id: string;
  description?: string;
  updated_at?: string;
  files?: Record<string, unknown>;
};

export const getGistData = async (gistId: string, pat: string) => {
  const response = await fetch(`${GITHUB_API_URL}/${gistId}`, {
    headers: {
      'Authorization': `token ${pat}`,
      'Accept': 'application/vnd.github.v3+json',
    }
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch gist: ${response.statusText}`);
  }

  const data = await response.json();
  if (data.files && data.files[FILENAME]) {
    return JSON.parse(data.files[FILENAME].content);
  }
  return null;
};

const getPortfolioDataScore = (data: any) => {
  if (!data || typeof data !== 'object') return 0;
  const exhibitions = Array.isArray(data.exhibitions) ? data.exhibitions.length : 0;
  const locationMilestones = Array.isArray(data.locationMilestones) ? data.locationMilestones.length : 0;
  return exhibitions * 10 + locationMilestones;
};

export const findExistingPortfolioGist = async (pat: string) => {
  const response = await fetch(`${GITHUB_API_URL}?per_page=100`, {
    headers: {
      'Authorization': `token ${pat}`,
      'Accept': 'application/vnd.github.v3+json',
    }
  });

  if (!response.ok) {
    throw new Error(`Failed to list gists: ${response.statusText}`);
  }

  const gists = (await response.json()) as GistSummary[];
  const candidates = gists
    .filter((gist) => gist.files?.[FILENAME] || gist.description === DESCRIPTION)
    .sort((a, b) => Date.parse(b.updated_at || '') - Date.parse(a.updated_at || ''));

  let bestMatch: { id: string; data: any; score: number; updatedAt: number } | null = null;

  for (const gist of candidates) {
    try {
      const data = await getGistData(gist.id, pat);
      if (!data) continue;

      const score = getPortfolioDataScore(data);
      const updatedAt = Date.parse(gist.updated_at || '') || 0;
      if (!bestMatch || score > bestMatch.score || (score === bestMatch.score && updatedAt > bestMatch.updatedAt)) {
        bestMatch = { id: gist.id, data, score, updatedAt };
      }
    } catch (err) {
      console.warn('Skipping unreadable Portfolio Tool gist', gist.id, err);
    }
  }

  return bestMatch;
};

export const updateGistData = async (gistId: string, pat: string, content: any) => {
  const response = await fetch(`${GITHUB_API_URL}/${gistId}`, {
    method: 'PATCH',
    headers: {
      'Authorization': `token ${pat}`,
      'Accept': 'application/vnd.github.v3+json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      files: {
        [FILENAME]: {
          content: JSON.stringify(content, null, 2)
        }
      }
    })
  });

  if (!response.ok) {
    throw new Error(`Failed to update gist: ${response.statusText}`);
  }

  return response.json();
};

export const createGist = async (pat: string, content: any) => {
  const response = await fetch(GITHUB_API_URL, {
    method: 'POST',
    headers: {
      'Authorization': `token ${pat}`,
      'Accept': 'application/vnd.github.v3+json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      description: DESCRIPTION,
      public: false,
      files: {
        [FILENAME]: {
          content: JSON.stringify(content, null, 2)
        }
      }
    })
  });

  if (!response.ok) {
    throw new Error(`Failed to create gist: ${response.statusText}`);
  }

  const data = await response.json();
  return data.id;
};
