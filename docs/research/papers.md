# Citation verification

Both papers cited in the project brief **exist**. Neither is fabricated. One venue claim is confirmed via a primary source; one interpretation in the brief is wrong.

## 1. XBIDetective — VERIFIED, including venue

- **Title (exact):** *XBIDetective: Leveraging Vision Language Models for Identifying Cross-Browser Visual Inconsistencies*
- **Authors:** Balreet Grewal, James Graham, Jeff Muizelaar, Jan Honza Odvarko, Suhaib Mujahid, Marco Castelluccio, Cor-Paul Bezemer
- **arXiv:** [2512.15804](https://arxiv.org/abs/2512.15804), cs.SE, submitted 2025-12-16
- **Venue:** ICSE-SEIP 2026. The arXiv record carries no `comment` field, and the paper does **not** appear in the partial SEIP program listing on conf.researchr.org. However the authors' own lab publication page (ASGAARD, University of Alberta ECE) lists it verbatim as *"International Conference on Software Engineering — Software Engineering in Practice (ICSE - SEIP) Track, 2026"*. Treating the authors' own listing as primary: **venue claim confirmed.**
- **Affiliations:** confirmed. Muizelaar, Odvarko, Mujahid, Castelluccio are Mozilla; Grewal and Bezemer are the ASGAARD lab (Analytics of Software, GAmes And Repository Data), Electrical & Computer Engineering, University of Alberta. The brief's "Mozilla + University of Alberta" is right.
- **What it actually does:** screenshots from **Firefox and Chrome only** (not WebKit), fed to vision language models. A fine-tuned VLM reached **79%** accuracy detecting cross-browser inconsistencies, **84%** identifying dynamic elements, **85%** identifying advertisements, across **1,052** websites.
- **Note for us:** two of the three headline numbers are *noise classification*, not defect detection. Mozilla's hard problem was separating real inconsistency from ads and dynamic content — the same conclusion Experiment 01 reached independently.

A near-neighbour worth knowing: *Browserbite: Cross-Browser Testing via Image Processing* (Saar, Dumas, Kaljuve, Semenenko), [arXiv:1503.03378](https://arxiv.org/abs/1503.03378), 2015 — the pre-VLM version of the same idea.

## 2. "Beyond Pixel Diffs" — VERIFIED, but the brief misreads its scope

- **Title (exact):** *Beyond Pixel Diffs: Benchmarking Image Change Captioning for Web UI Visual Regression Testing*
- **Authors:** Licheng Zhang, Bach Le, Pengtao Zhao, Naveed Akhtar
- **arXiv:** [2607.01728](https://arxiv.org/abs/2607.01728), cs.CV / cs.CL / cs.SE, submitted 2026-07-02
- The brief's shorthand "Web UI Image Change Captioning" is the task name the paper coins (**WUICC**); the benchmark is **WUICC-bench**.
- **Taxonomy — brief is broadly right.** 37 atomic rules in 12 categories. *Meaningful (9):* missing elements, adding elements, attribute modification, layout changes, reordering, resizing, content update, thematic changes, replacement. *Non-meaningful (3):* geometric shifts, dynamic content changes, pure style changes.
- **Dataset:** 9,906 samples (8,583 meaningful / 1,323 non-meaningful), built by LLM-driven mutation of HTML from the WebSight corpus (itself LLM-synthesized pages), rendered headless at a fixed 1280px width, human-verified at Cohen's κ = 0.722.

**Two corrections the brief needs:**

1. **This paper is not cross-browser.** Quoting the source: *"No comparison across browsers or versions occurs in this work."* It is single-browser, single-viewport, synthetic-mutation temporal regression testing. It supports the general claim "semantic classification beats pixel diffing." It does **not** provide evidence for cross-*engine* semantic classification. Citing it as a basis for the cross-browser design overstates it.
2. **It is evidence *against* the proposed v0.2 zero-shot VLM layer.** Best trained model (SparseFocus) reached only 0.2571 BLEU-4 / 2.0761 CIDEr; the authors call absolute scores "low across both groups, indicating the difficulty of our benchmark." Zero-shot VLMs did far worse — Llama-3.2-11B at **0.0363** BLEU-4, Qwen2-VL at **0.0920**. An off-the-shelf VLM asked to caption UI changes is, as of mid-2026, weak at this task. The paper's one encouraging result is directional and matches our thesis: *"Trained IDC methods suppress non-meaningful changes far more selectively than pixel-level comparison while still reporting almost all genuine changes."*

## Verdict

No fabrication. The research basis is real and the framing ("pixel diffs are the wrong primitive; noise suppression is the hard part") is well supported by both papers. The specific claim that has to be dropped is that paper 2 validates cross-browser semantic classification — it does not, and the field's published zero-shot VLM numbers argue for keeping the AI layer optional and late.
