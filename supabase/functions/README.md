# Estim8r Edge Functions

## `search-supplier-catalog`

Server proxy for live distributor catalog search. The browser never receives supplier API keys.

Required secrets (set only the catalogs you use):

- `MOUSER_API_KEY`
- `DIGIKEY_CLIENT_ID`, `DIGIKEY_CLIENT_SECRET`, optional `DIGIKEY_SANDBOX`
- `NEXAR_CLIENT_ID`, `NEXAR_CLIENT_SECRET`
- `ELEMENT14_API_KEY`, optional `ELEMENT14_STORE_ID` (default `us`)

```bash
supabase functions deploy search-supplier-catalog --project-ref gqdxvctvufalunaaopyj
```

Do not run `supabase db push` of Estim8r migrations against this shared project. The function requires a signed-in `Authorization` header. Empty credentials return no prices; it does not invent them.

## `owner-agent-chat`

Owner-only chat proxy for the in-app workspace assistant. The browser never receives the Gemini API key.

Required secrets:

- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `GEMINI_API_KEY`

Optional settings:

- `ESTIM8R_AGENT_MODEL` (default `gemini-2.5-flash`)
- `ESTIM8R_APP_ORIGIN` for the primary deployed app origin
- `ESTIM8R_APP_ORIGINS` for comma-separated preview/custom origins
- `ESTIM8R_AGENT_OWNER_EMAILS` for comma-separated additional owner emails; the platform owner and backup admin are always allowed
