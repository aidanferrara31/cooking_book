export type RecipeListItem = {
  slug: string;
  title: string;
  filename: string;
};

export type RecipeDetail = {
  slug: string;
  title: string;
  filename: string;
  markdown: string;
};

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, init);
  if (!res.ok) {
    const msg = await res.text().catch(() => "");
    throw new Error(msg || `Request failed: ${res.status}`);
  }
  return (await res.json()) as T;
}

export function listRecipes(): Promise<RecipeListItem[]> {
  return api<RecipeListItem[]>("/api/recipes");
}

export function getRecipe(slug: string): Promise<RecipeDetail> {
  return api<RecipeDetail>(`/api/recipes/${encodeURIComponent(slug)}`);
}


