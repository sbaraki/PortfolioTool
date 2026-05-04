const GITHUB_API_URL = 'https://api.github.com/gists';
const FILENAME = 'museum-data.json';

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
      description: 'Museum Portfolio Timeline Backup',
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
