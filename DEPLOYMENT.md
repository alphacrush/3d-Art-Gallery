# Vercel deployment

The app uses Next.js API routes, PostgreSQL, and Supabase Storage. Before deploying,
configure these Vercel environment variables:

| Variable | Purpose |
| --- | --- |
| `DATABASE_URL` | PostgreSQL connection string |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Public key used by the browser for Storage uploads |
| `SUPABASE_SECRET_KEY` | Server-only key used to create one-time upload URLs |
| `SUPABASE_STORAGE_BUCKET` | Storage bucket name; defaults to `gallery-assets` |

Create a Supabase Storage bucket with the configured name. Make it public so artwork
can be displayed in the gallery, and set its file-size limit to 30 MB. Keep
`SUPABASE_SECRET_KEY` server-only: do not prefix it with `NEXT_PUBLIC_` or expose
it in client code. The `.env.example` file lists the expected variable names.

The upload API only creates a signed upload URL; the browser sends the file directly
to Supabase Storage. This avoids Vercel Function request-size limits and keeps
uploaded files out of the function's temporary filesystem.

The production build command is `npm run build`. The current local `main` branch is
older than the workspace changes, so make sure Vercel deploys the intended code:
push the intended changes before using Git-based deployment, or deploy the local
workspace through the Vercel CLI after signing in.
