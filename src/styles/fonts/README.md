# Self-hosted fonts

Every typeface the app uses is a Google Font (all under the SIL Open Font
License), stored here and loaded with `next/font/local`.

They used to load through `next/font/google`, which downloads them during
`next build`. On Vercel that download failed again and again under Turbopack
("Can't resolve '@vercel/turbopack-next/internal/font/google/font'"), breaking
preview builds at random. With the files in the repo the build makes no
font requests.

Only the latin subset is kept, the same subset the layouts asked Google for.
Files ending in `-variable` hold a range of weights in one file.

To add a weight or a family: download the woff2 that
`https://fonts.googleapis.com/css2?family=...` points to for the `/* latin */`
block, put it here, and add it to the `localFont({ src: [...] })` call in the
layout that uses it.
