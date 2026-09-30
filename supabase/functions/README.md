# Estim8r Edge Functions

## `search-supplier-catalog`

Server proxy for live distributor catalog search. The browser never receives supplier API keys.

Required secrets (set only the catalogs you use):

- `MOUSER_API_KEY`
- `DIGIKEY_CLIENT_ID`, `DIGIKEY_CLIENT_SECRET`, optional `DIGIKEY_SANDBOX`
- `NEXAR_CLIENT_ID`, `NEXAR_CLIENT_SECRET`
- `ELEMENT14_API_KEY`, optional `ELEMENT14_STORE_ID` (default `us`)

```bash
supabase functions deploy search-supplier-catalog
```

The function requires a signed-in `Authorization` header. Empty credentials return no prices; it does not invent them.
