# Exploratory skin populations

The separately distributed skin v2 packages provide three population maps:
L1-normalized Euclidean, max-normalized Euclidean and max-normalized L∞.
Each map uses its own original-space target distances. A participant or visit
selection keeps those population coordinates; it is not a locally fitted map.
Different populations have unrelated axes.

The first registered release contains four Huang collection populations
(Flores temporal skin, American Gut skin subset, maternal forehead and ABTX)
and three study-10894 populations (infant forearm, maternal forearm and maternal
right areola). These remain separate from the existing v1 EAT/COPSAC fixtures.
Registration pins the exact dataset, study, title, capability, revision and
manifest checksum. Unregistered or modified bundles fail before activation.

## Metadata, trajectories and warnings

Valid abundance profiles remain visible even when participant or visit metadata
are uncertain. Participant navigation includes only verified identities. Unknown
or unverified attributes remain explicit in specimen views and exports; an
unlinked specimen is not counted as an additional known participant. The Flores
population includes 414 specimens without verified participant links.

Trajectories use only the vetted, consecutive same-site edges supplied by the
data producer. Select a participant to display these paths. Filtering to a site
or visit retains the existing induced edge set and never creates a bridge over
hidden visits. Both displayed specimens and trajectory exports contain exactly
their corresponding visible membership. ABTX has no temporal edges. Study 10894
uses ordinal visit times and excludes HR.20. Speed is disabled throughout this
release. Family annotations never create maternal–infant trajectories.

The unresolved batch/metadata notices and method-specific distance distortion
and neighbor recovery remain visible and accompany specimen, edge and PNG
exports. No additional contaminant filter is introduced by installation.
The maternal-forearm population has particularly weak local neighbor recovery;
important apparent neighborhoods require checking in the original abundance
space. A low overall distance error is not evidence of biological validity.

Colors identify visit order within a population, with unknown visits gray. For
more than eight visit orders the palette repeats; the textual visit legend and
hover label identify the order explicitly. Neither colors nor straight line
lengths encode elapsed time. All selections retain the same padded population
frame, preventing a narrow subset from changing the displayed axis proportions.

## Installation and updates

The installer accepts one or more registered exchange directories:

```sh
python3 scripts/portable.py update --skin-exchange /path/to/first-exchange /path/to/second-exchange
```

It remembers those paths for subsequent ordinary updates. Keep these data outside
the installed app. The sparse count tables are validated offline and remain in
the separate data package; the plotting payload never contains a dense ASV
matrix. Installation stages and verifies a candidate before replacing the app;
the previous installation is retained for recovery. An unchanged revision is
idempotent; a conflicting revision fails.

A selectable skin-only catalogue supports fresh single-population or combined
installations using the standard `--catalog` and `--datasets` options. Dataset
and metadata reuse terms are separate from the software license.

## On-demand checks

```sh
python3 -m unittest discover -s scripts -p test_skin_supplement.py
COSMIX_SKIN_BUNDLE=/path/to/registered-exchange python3 -m unittest discover -s scripts -p test_skin_supplement.py
node rank2_feature_graph/test_skin_population_v2.cjs /path/to/installed-app
```

The first command checks types without scientific files; the second additionally
checks registered data, attachment identity, tampering and failure preservation.
The JavaScript check verifies selection membership, vetted edges and coordinate
coverage in each installed v2 population. Browser rendering, navigation, common
framing and warning-bearing downloads require separate browser checks. Tests
are on demand and are not part of the ordinary update command. No test refits a
model.
