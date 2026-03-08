import { useEffect, useMemo, useState } from "react";
import ReactMarkdown from "react-markdown";
import { getRecipe, listRecipes, type RecipeDetail, type RecipeListItem } from "./api";

function classNames(...xs: Array<string | false | null | undefined>): string {
  return xs.filter(Boolean).join(" ");
}

function canonicalizeSlug(slug: string): string {
  return slug.replace(/([_-])IMG[_-]?\d+$/i, "").trim().toLowerCase();
}

function categorizeRecipe(title: string): string {
  const t = title.toLowerCase();

  // Soups
  if (t.includes("soup")) return "Soups";

  // Sides
  if (t.includes("potato") || t.includes("potatoes")) return "Sides";
  if (t.includes("mac") && t.includes("cheese")) return "Sides";
  if (t.includes("cornbread")) return "Sides";

  // Sauces / toppings
  // NOTE: some mains include "sauce" in the title (e.g. meatballs and sauce) so handle those first.
  if (t.includes("meatball")) return "Mains";
  if (t.includes("sauce")) return "Sauces & Toppings";

  // Mains
  if (t.includes("manicotti")) return "Mains";

  // Appetizers / snacks
  if (t.includes("dip")) return "Appetizers & Snacks";
  if (t.includes("brie") || t.includes("cheese puff") || t.includes("cheese puffs")) return "Appetizers & Snacks";
  if (t.includes("stuffed mushrooms") || (t.includes("stuffed") && t.includes("mushroom"))) return "Appetizers & Snacks";

  // Breads / breakfast
  if (t.includes("bread") || t.includes("muffin") || t.includes("scone") || t.includes("casserole")) return "Breads & Breakfast";

  // Desserts (default)
  if (
    t.includes("cake") ||
    t.includes("pie") ||
    t.includes("pudding") ||
    t.includes("pastry") ||
    t.includes("squares") ||
    t.includes("roll") ||
    t.includes("cookies") ||
    t.includes("cookie")
  ) {
    return "Desserts";
  }

  return "Desserts";
}

type SplitRecipeMarkdown = {
  ingredientsMarkdown: string;
  rightMarkdown: string;
};

function splitRecipeMarkdown(markdown: string): SplitRecipeMarkdown {
  const md = markdown.replace(/\r\n/g, "\n").replace(/^\uFEFF/, "");

  // If the markdown includes a top-level title, the UI already shows `selected.title`.
  const mdWithoutH1 = md.replace(/^# .*\n+/, "");

  const headingRe = /^##\s+(.+)\s*$/gm;
  const headings: Array<{ title: string; index: number }> = [];
  for (const m of mdWithoutH1.matchAll(headingRe)) {
    headings.push({ title: (m[1] ?? "").trim(), index: m.index ?? 0 });
  }

  const norm = (s: string) => s.trim().toLowerCase();
  const isIngredientsHeading = (t: string) => ["ingredients"].includes(norm(t));
  const isRightHeading = (t: string) => ["directions", "direction", "notes", "note"].includes(norm(t));

  // Prefer explicit "Ingredients" section when present.
  const ingredientsHeading = headings.find((h) => isIngredientsHeading(h.title));
  if (ingredientsHeading) {
    const start = ingredientsHeading.index;
    const next = headings.find((h) => h.index > start);
    const ing = mdWithoutH1.slice(start, next?.index ?? mdWithoutH1.length).trim();
    const rest = mdWithoutH1.slice(next?.index ?? mdWithoutH1.length).trim();
    return { ingredientsMarkdown: ing, rightMarkdown: rest };
  }

  // Otherwise, treat everything before the first "Directions/Note(s)" heading as ingredients.
  const rightStart = headings.find((h) => isRightHeading(h.title))?.index ?? -1;
  if (rightStart !== -1) {
    return {
      ingredientsMarkdown: mdWithoutH1.slice(0, rightStart).trim(),
      rightMarkdown: mdWithoutH1.slice(rightStart).trim(),
    };
  }

  // Fallback: keep everything on the left.
  return { ingredientsMarkdown: mdWithoutH1.trim(), rightMarkdown: "" };
}

export function App() {
  const [recipes, setRecipes] = useState<RecipeListItem[]>([]);
  const [selectedSlug, setSelectedSlug] = useState<string | null>(null);
  const [selected, setSelected] = useState<RecipeDetail | null>(null);

  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState<string>("");

  const selectedIndex = useMemo(() => {
    if (!selectedSlug) return -1;
    return recipes.findIndex((r) => r.slug === selectedSlug);
  }, [recipes, selectedSlug]);

  const canPrev = selectedIndex > 0;
  const canNext = selectedIndex !== -1 && selectedIndex < recipes.length - 1;

  const recipesByCategory = useMemo(() => {
    // Dedupe same recipe (scanned IMG vs clean file): prefer the non-IMG slug when both exist.
    const byCanon = new Map<string, RecipeListItem>();
    for (const r of recipes) {
      const key = canonicalizeSlug(r.slug);
      const prev = byCanon.get(key);
      if (!prev) {
        byCanon.set(key, r);
        continue;
      }
      const prevIsImg = /([_-])IMG[_-]?\d+$/i.test(prev.slug);
      const curIsImg = /([_-])IMG[_-]?\d+$/i.test(r.slug);
      if (prevIsImg && !curIsImg) byCanon.set(key, r);
    }

    const groups = new Map<string, RecipeListItem[]>();
    for (const r of Array.from(byCanon.values()).sort((a, b) => a.title.localeCompare(b.title))) {
      const cat = categorizeRecipe(r.title);
      const arr = groups.get(cat) ?? [];
      arr.push(r);
      groups.set(cat, arr);
    }
    return groups;
  }, [recipes]);

  const normalizedSearch = useMemo(() => searchQuery.trim().toLowerCase(), [searchQuery]);

  const splitMd = useMemo(() => {
    if (!selected?.markdown) return null;
    return splitRecipeMarkdown(selected.markdown);
  }, [selected?.markdown]);

  async function refresh() {
    setErr(null);
    try {
      const items = await listRecipes();
      setRecipes(items);
      if (!selectedSlug && items.length > 0) setSelectedSlug(items[0].slug);
      if (selectedSlug && !items.some((r) => r.slug === selectedSlug)) {
        setSelectedSlug(items[0]?.slug ?? null);
      }
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : String(e));
      setRecipes([]);
      setSelectedSlug(null);
      setSelected(null);
    }
  }

  useEffect(() => {
    void refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!selectedSlug) {
      setSelected(null);
      return;
    }
    setErr(null);
    setBusy(true);
    getRecipe(selectedSlug)
      .then(setSelected)
      .catch((e: unknown) => setErr(e instanceof Error ? e.message : String(e)))
      .finally(() => setBusy(false));
  }, [selectedSlug]);

  function goPrev() {
    if (!canPrev) return;
    setSelectedSlug(recipes[selectedIndex - 1].slug);
  }

  function goNext() {
    if (!canNext) return;
    setSelectedSlug(recipes[selectedIndex + 1].slug);
  }

  return (
    <div className="appShell">
      <header className="topBar">
        <div className="brand">
          <div className="brandMark" />
          <div>
            <div className="brandTitle">Ferrara &amp; Cronin Cook Book</div>
          </div>
        </div>
      </header>

      <div className="main">
        <aside className="sidebar">
          <div className="sidebarHeader">Recipes</div>
          <div className="sidebarList">
            {recipes.length === 0 ? (
              <div className="muted">
                No recipes yet. Add Markdown files to <code>./data/recipes</code> and refresh.
              </div>
            ) : (
              <>
                <input
                  className="sidebarSearch"
                  placeholder="Search recipes…"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  disabled={busy}
                />

                {Array.from(recipesByCategory.entries())
                  .sort((a, b) => a[0].localeCompare(b[0]))
                  .map(([category, items]) => {
                    const filtered = normalizedSearch
                      ? items.filter((r) => r.title.toLowerCase().includes(normalizedSearch))
                      : items;

                    return (
                      <div key={category} className="sidebarGroup">
                        <div className="sidebarGroupHeader">
                          <div className="sidebarGroupTitle">{category}</div>
                          <div className="sidebarGroupCount">
                            {normalizedSearch ? `${filtered.length} / ${items.length}` : items.length}
                          </div>
                        </div>

                        <div className="sidebarGroupItems">
                          {filtered.length === 0 ? (
                            <div className="muted sidebarEmpty">No matches.</div>
                          ) : (
                            filtered.map((r) => (
                              <button
                                key={r.slug}
                                className={classNames("sidebarItem", r.slug === selectedSlug && "active")}
                                onClick={() => setSelectedSlug(r.slug)}
                                disabled={busy}
                              >
                                <div className="sidebarItemTitle">{r.title}</div>
                              </button>
                            ))
                          )}
                        </div>
                      </div>
                    );
                  })}
              </>
            )}
          </div>
        </aside>

        <section className="bookArea">
          <div className="bookControls">
            <button className="btnSecondary" onClick={goPrev} disabled={!canPrev || busy}>
              ← Prev
            </button>
            <div className="pageCounter">
              {recipes.length === 0 || selectedIndex === -1 ? "—" : `${selectedIndex + 1} / ${recipes.length}`}
            </div>
            <button className="btnSecondary" onClick={() => void refresh()} disabled={busy}>
              Refresh
            </button>
            <button className="btnSecondary" onClick={goNext} disabled={!canNext || busy}>
              Next →
            </button>
          </div>

          {err ? <div className="errorBox">{err}</div> : null}

          <div className={classNames("book", busy && "busy")}>
            <div className="bookSpine" />
            <div className="page">
              {selected ? (
                <>
                  <div className="pageTitle">{selected.title}</div>
                  <div className="pageBody">
                    <div className="recipeTwoCol">
                      <div className="pageCol pageColLeft">
                        <ReactMarkdown>{splitMd?.ingredientsMarkdown ?? selected.markdown}</ReactMarkdown>
                      </div>
                      <div className="pageCol pageColRight">
                        {splitMd?.rightMarkdown ? <ReactMarkdown>{splitMd.rightMarkdown}</ReactMarkdown> : null}
                      </div>
                    </div>
                  </div>
                </>
              ) : (
                <div className="muted">Select a recipe.</div>
              )}
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}


