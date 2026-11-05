# AGP 1-CST connections by coverage

The graph defaults to the **merged q%-1-CSTs** chosen by Color by (70%, 80%
 or 90%). **Pure 1-CST graph** instead uses the corresponding retained original
leading-taxon states. Both choices use the same original-space neighbors, but
merged weights and node counts are recomputed from that coverage's frozen
merged memberships. The pure graph selects a subset of the original pure-state
analysis. Its edge weights therefore remain the same across coverage levels;
merged weights generally change. Titles distinguish these meanings explicitly.

The graph checkbox does not change samples, assignments, local fits or sample
coordinates. The header's Assign remaining samples checkbox continues to control
sample display. An edge highlights only boundary records present in that display;
the edge table reports the whole graph's boundary counts. Neither selection nor
edge-display filters recomputes the saved weights.

The default **Population metric-MDS · [geometry] · 3D** layout reuses the
selected population embedding's coordinates for each taxon's highest-abundance
observed reference sample. These are SGD metric-MDS sample coordinates, not a
fit of connection weights. The reference positions stay fixed across coverage
and pure/merged graph changes. **State diagram · 2D** is a schematic row layout.
The 2-CST graph also retains **Graph edge-layout · 3D**, with its explicit Spring,
Metric MDS (SGD), GRIP and Weighted GRIP method selector and edge-target controls.
Those saved pair-graph fits are not repurposed as 1-CST connection-graph fits.
Existing saved 1-CST layout preferences migrate once to the reference 3D view;
subsequent layout choices and the pure-graph checkbox are remembered.

The optional `merged-1cst-connections.json` supplement is pinned and checked
against every coverage's membership vector. Old pure-only packages remain
usable, clearly labeled pure, until the data supplement is installed. Source
updates cannot manufacture missing numerical supplements.

The aggregation source is `scripts/agp_state_connections/merged_viewer.py` in
the owning gut-microbiome project. It reuses checksummed neighbor lists, covers
27 geometry/scale/coverage combinations, and independently enumerates 81 pair
checks. All previous files, memberships and embeddings are preserved. The pure
L∞ tie audit below is not claimed as a merged-state tie-sensitivity validation.

## Preserved pure-core methods and audit

# Pure 1-CST connections

## What question does this graph answer?

Which pure leading-taxon states meet through nearby samples in the original
abundance space? These connections describe sample proximity. They are not
temporal transitions, interaction probabilities, or significance tests.

The original pure-core supplement remains separate and unchanged. The new
merged supplement adds coverage-specific aggregations, as described above.
Both are separately distributed with the AGP data; neither contains new fits.

## Controls and selection

- **Requested neighbors:** 10, 20 or 40, initially 20. All cutoff ties are
  included, so the actual count may be larger. The panel shows how many queries
  in the displayed cores have extra ties and their largest neighborhood.
- **Edge measure:** boundary weight (default), contact intensity, expanded
  Jaccard, or PAGA connectivity.
- **Boundary rule:** inclusive or two-state only. This changes boundary weight
  and its support; it is disabled for the other three measures, which use
  inclusive neighborhoods.
- **Minimum edge weight:** initially 0.05. Zero-weight pairs are never drawn.
- **Min boundary samples / side:** initially 5; each side must meet this count.
  Set both thresholds to zero to include Jaccard connections with no direct
  boundary support. These thresholds are display choices, not significance tests.

Edge thickness scales with the chosen weight relative to the largest pair weight
in the current retained-core graph, before display filtering. The existing width,
scaling strength, fading, degree, color and layout controls remain available.
Degree counts connections passing weight/support filters, before the degree
filter. Node area represents the chosen pure or merged state sample count. In the population metric-MDS
3D layout, sphere size/color/lighting controls are available; positions remain
the saved observed reference coordinates. No graph or sample fit runs.

Click an edge or use **Connection** to see both sides' counts, state sizes and
percentages, plus unique known participants across both boundaries and unlinked
records. Boundary samples retain their state colors; other currently displayed
samples are gray, when they are outside the chosen boundary. The saved population coordinates and sample set do
not change. An edge hidden by a subsequent display filter can remain selected;
the picker explicitly marks it hidden. Back, Forward and Clear selection also
work for connections. Vertex selection continues to open the existing pure or
merged local embedding, according to the assignment checkbox. Graph node sizes,
counts, positions and edges remain those of the whole pure-core graph.
Connection selection uses the population map because it spans states.

Changing geometry or neighbor count updates connections using their matching
saved original-space calculations. Changing assignment preserves the selected
connection and highlights the same pure-core boundary samples. Coverage changes
reset selection. No memberships or stored coordinates
are rewritten. Hidden states remain eligible neighbors at every coverage.

## Returning to AGP

CoSMiX remembers AGP's coverage/coloring, pure or merged display, embedding
method, unfolding, selected vertex or connection, Back/Forward history, graph
settings and reference-sphere appearance. Camera positions and zoom, expanded
panels and open information sections are restored too. Changes are saved as
you work, including when you switch datasets, reload or close the tab.

Preferences belong to this browser and site address, independently of other
datasets. Reopen the same address to resume; another browser, port or private
session has separate storage. Clearing site data removes these preferences.
Existing settings remain valid when only saved fits are updated. A different
underlying sample/taxon matrix starts with defaults; unavailable options or
selections are ignored safely. No samples or fitted coordinates are stored in
the preference record.

## Definitions

Let N be all 24,421 frozen records. A and B are disjoint pure states of sizes
n_A and n_B. Normalize each profile either by its sum or its maximum, then use
Euclidean distance or max-coordinate distance as selected. Neighborhood N_h(x)
excludes its center and contains all records at distance at most the h-th
distance plus 10^-12. Let m_x be its actual size, including ties.

- A-side boundary: records x in A with at least one neighbor in B. If its
  count is b_A, the directed fraction is f_A = b_A/n_A. The symmetric boundary
  weight is W = sqrt(f_A*f_B). It is not the fraction in the pooled groups.
- A two-state-only boundary additionally requires the center and every neighbor
  to be in A or B. Hidden third states also disqualify a neighborhood.
- Directed intensity: P_A = (1/n_A) sum over x in A of |N_h(x) intersect B|/m_x.
  Symmetric intensity is sqrt(P_A*P_B). Each query receives equal weight.
- H_A is A expanded by all neighbors of every record in A. Expanded Jaccard is
  |H_A intersect H_B|/|H_A union H_B|. Both states can reach a third state, so
  this can be positive without direct contact between A and B.
- PAGA is min(1,C/E), where C is the number of directed cross-state links in
  both directions, e_A and e_B are total outgoing links from each state, and
  E = (e_A*n_B + e_B*n_A)/(N-1). It compares observed links with uniformly random
  destinations. A value of one is a cap, not certainty or full boundary coverage.

All four weights lie between zero and one but measure different quantities.
The expected-count normalization follows Scanpy 1.11.5's PAGA model v1.2.
See [the pinned implementation](https://github.com/scverse/scanpy/blob/1.11.5/src/scanpy/tools/_paga.py)
and [the PAGA paper](https://doi.org/10.1186/s13059-019-1663-x).

## Tie sensitivity and limitations

The accompanying audit compares including all ties with exact averages over
uniformly chosen fixed-size subsets of cutoff ties; it does not choose ties by
record order. Boundary weights are formed from expected directed fractions.
At 90% coverage and h=20, the leading 20 boundary connections are unchanged,
rank correlation is 0.99854, and the largest absolute boundary-weight change is
0.00728. PAGA is more sensitive: the largest change at that scope is 0.29355.
Expanded Jaccard was not averaged under the fixed-size rule.

The viewer retains the include-all-ties analysis. It shows the boundary-rank
audit alongside the actual neighborhood counts and cautions when viewing PAGA
under L-infinity. Repeated observations remain in the specimen-level analysis;
the participant counts describe support, not statistical independence. A state
with at most h samples must have some external neighbors. The present 37
retained cores all exceed 40 samples, although the full collection includes
smaller states. Neighbor search includes those states too.

## Selecting objects in 3D

Click a sphere, flat vertex marker or its label to open the existing local
1-CST sample embedding. Click anywhere along a visible connection to highlight
its boundary samples in the population map and populate the connection table.
Sample membership follows the header's Assign remaining samples setting; graph
membership follows Pure 1-CST graph. Selecting a connection does not change
sample coordinates or the displayed sample set. Back, Forward and Clear
selection share the same selection history as the table controls.

The picker uses the currently rendered camera, sphere sizes and visible edge
segments. A label selects its named vertex, and a sphere takes precedence over
an edge at their shared endpoint. Selection occurs once on a stationary primary
pointer release. Repeated WebGL frame events, rotation/pan gestures, canceled
presses and clicks queued for a replaced view cannot add selections. This also
applies to the saved 3D pair-graph layouts. Flat 2D diagrams retain selection.

## On-demand checks

```sh
node rank2_feature_graph/test_agp_graph_picking.cjs
node rank2_feature_graph/test_agp_graph_picking_browser.cjs http://127.0.0.1:4173 /path/to/population.json
node rank2_feature_graph/test_agp_connections.cjs /path/to/population.json
COSMIX_AGP_CONNECTIONS=/path/to/package python3 -m unittest discover -s scripts -p test_agp_connections.py
node rank2_feature_graph/test_agp_connections_browser.cjs http://127.0.0.1:4173 /path/to/population.json
```

The browser check needs Playwright and Chrome. Checks use saved assets, run no
fits, and remain outside installation and update commands. The numerical audit
and reproducible data-generation sources remain with the owning AGP project.
