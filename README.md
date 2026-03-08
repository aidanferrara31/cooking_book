<<<<<<< HEAD
# cooking_book

Minimal cookbook-style web app:
- Cookbook-style “page flip” viewer for Markdown recipes
- For now, you add recipes by placing `.md` files in `./data/recipes`
- Your separate agent/process can generate the `.md` files (this app only reads them)

## Run (Docker)

```bash
docker compose up --build
```

- Frontend: `http://localhost:3000`
- Backend: `http://localhost:8000`

Recipes are persisted on your machine in `./data/recipes`.

## Notes

- This is designed for single-user/local use for now (no auth).

## Recipe format

- Put files in: `./data/recipes/*.md`
- Title behavior:
  - If your file starts with YAML frontmatter containing `title: ...`, we use that
  - Otherwise we fall back to the filename (without `.md`)

## Troubleshooting

- If you see `Cannot connect to the Docker daemon ...`, start Docker Desktop (or your Docker daemon) and retry.


=======
# cooking_book
>>>>>>> 3b4b87f7ec8ec622c6c677d2d30d048453ee0655
