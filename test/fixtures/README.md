# Frozen evidence for the offline tests

`m0/results/evidence/` is gitignored — 30 pages, 14 MB, regenerable with
`npm run m0`. These three pages are copied here and committed so the tolerance
tests run on a fresh clone with no browser and no corpus run.

They are verbatim copies, minified only. If the suppression rules change, the
survivor counts asserted in `test/funnel.test.mjs` change with them, which is
the point: the published numbers move visibly or not at all.
