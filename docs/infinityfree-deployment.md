# InfinityFree static website setup

This repository is a Next.js application and cannot run its server routes or Node.js runtime on InfinityFree shared hosting. The root `index.html` is a lightweight, static InfinityFree homepage that embeds the RJ FM 93.5 player hosted on Render.

## Upload to InfinityFree

1. Download the ZIP of the branch `fix/infinityfree-static-homepage`.
2. Extract the ZIP on your computer or phone.
3. Open InfinityFree File Manager and enter `htdocs`.
4. Upload the root `index.html` and `.htaccess` files directly into `htdocs` (not the enclosing GitHub ZIP folder).
5. Make sure `index.html` is directly inside `htdocs`.
6. Open your domain and refresh. If you still see a 403, check that the domain points to the correct hosting account and that `htdocs/index.html` exists.

The embedded player loads from:
`https://more-fm-automation-system-bgah.onrender.com/embed/rjfm935`

## Important limitations

- InfinityFree serves this static homepage only.
- The live player itself is hosted on Render and still depends on the Render app and its APIs.
- Next.js API routes, server-side AutoDJ, database access, and the continuous stream proxy are not moved to InfinityFree.
- A Radio Browser continuous stream still requires a real upstream Icecast/Shoutcast-compatible audio stream configured on the Render deployment.
