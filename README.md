# Estim8r

Electrical estimating for Current Flow. Take off drawings, build a labor-backed estimate, and keep project documents together under the project name.

## Local development

```bash
npm install
cp .env.example .env.local   # if present
npm run dev
```

The Vite app defaults to http://localhost:5177.

To save documents into Buildr, set:

```
VITE_BUILDR_URL=http://localhost:5173
VITE_BUILDR_API_URL=http://localhost:3001
```

Use the same email on both apps.

## Project documents

When drawings have been uploaded and an estimate exists:

1. **Buildr project already exists** — drawings, estimate, and markup pages are saved on that project’s Estimate tab.
2. **Buildr account, no matching project** — Estim8r asks whether to create the project. If yes, Estim8r and Buildr create it and save the documents there.
3. **No Buildr account** — documents stay in Estim8r’s Estimates folder, listed by project name with the project address underneath.
