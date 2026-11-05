# CoSMiX

Microbiome Community State Space Explorer

CoSMiX (pronounced **KOZ-mik**) lets you explore
the composition of microbial communities and their variation
across samples, cohorts, and participants over time.

CoSMiX connects sample embeddings, graphs of phylotypes and community states,
composition summaries, and participant trajectories. Selecting a state or
phylotype links these views, helping users examine the samples behind a pattern.

- **Explore samples in 3D.** Inspect community structure, compare available
  reference and local embeddings, and color samples by community state or
  dataset-specific annotations. Sample counts, percentages, and embedding
  distortion measures provide context for the display.
- **Examine community-state graphs.** View phylotypes as vertices and top-2
  community state types (CSTs) as edges. Inspect connections, sample coverage,
  and vertex characteristics; filter by degree or adjust fading to reveal
  less common states. Top-3 CSTs can also be displayed where available.
- **Follow participant trajectories.** Trace successive visits through
  community states and inspect changing phylotype abundances in stacked bars.
  Adjustable abundance thresholds highlight the phylotypes accounting for
  a chosen share of each sample.
- **Compare populations.** Explore dataset-specific cohorts, pure states,
  merged groups, and reference populations while retaining their distinct
  sample definitions and study context.
- **Save and share views.** Customize colors and layouts, save named views,
  and export figures and tables for further examination.

A top-k CST groups samples by the unordered set of their k most abundant
phylotypes. CoSMiX also supports other classifications, including VALENCIA2 CSTs
and subCSTs where supplied by a dataset.

Available views depend on the dataset and its accompanying metadata and saved
embeddings. Obtain all CoSMiX dataset packages and metadata supplements directly
from Pawel Gajer, on an individual basis. Contact him to arrange your own datasets
or public datasets already prepared for the explorer. This repository contains
the application source, not sample data; software updates do not download data.

If you use CoSMiX in your research, please cite the software using
[CITATION.cff](CITATION.cff). Cite research datasets separately according to
their providers' guidance.

For installation and choosing separately supplied datasets, see [Setup](MEETING_SETUP.md).
