# AGP conditional outcome estimates

Question: how does the probability of a reported condition vary with a microbiome
profile? An optional, separately supplied supplement adds saved estimates for
seasonal allergies, skin condition and IBS to the existing AGP maps. It does not
add samples, refit embeddings, change CST assignments or run models in the browser.

Open **Outcome estimates** in the left controls and turn on **Color by outcome probability**. Select an outcome, estimator, sample policy, fitting
population and estimate type. Initially the controls select ordinary kNN,
one index sample per participant, the global fit and held-out predictions.
The fixed Viridis probability scale is 0–100%. Gray indicates an unavailable
estimate; lighter gray can indicate samples outside a selected graph boundary.
Hover text distinguishes these cases and the recorded outcome. Missing answers
are never coded as negative and can still have valid predictions.

The CST selector continues to control the displayed states and graph. Separate
state estimates always use the eight **frozen merged 70%-1-CSTs**, even in pure
views or another coverage. The loader rejects mismatched frozen memberships.
Vertex/edge selection, local and unfolded views, navigation and saved settings
continue to operate. Estimates use exact intrinsic Euclidean path length on
the max-normalized 340-taxon surface, independently of the selected display map.

Ordinary kNN averages outcomes among k nearest participants. Raw nearest-case
estimation is k/T, and the stopping-rule correction is (k−1)/(T−1), where T is
the number of ranked participants needed to reach k positive cases. Thus k
counts participants for kNN and positive cases for the other methods. Tuning
uses participant cross-validation. Full formulas, outcome definitions, results
and limitations are in **Methods and interpretation → Download full methods
and results (PDF)**, supplied with the scientific data.

Held-out predictions exclude an entire outer participant fold; k is selected
in three inner folds. They support predictive evaluation. Full-reference
estimates exclude the query participant and use k selected by five-fold
participant CV; they are distinct from the held-out evaluation predictions.
The primary policy uses one outcome-independent index specimen and its own
answer. All-visits training uses each reference participant's nearest answering
visit. The model estimates probabilities among respondents. Predictive gains
over prevalence were modest, and these are not causal effects or clinical risk
estimates.

## Data and update contract

The optional `outcome-estimates.json` beside the supplied `population.json`
contains `agpOutcomeEstimates`, version 1. It has 24,411 unique sample IDs,
frozen state keys, 21,323 index positions, three observed-response arrays and
72 probability arrays. They are joined by sample ID, never viewer row order.
The existing 24,421-sample maps remain intact. Ten unlinked specimens have no
estimate; under the index policy, 3,088 further non-index specimens are null.
Null means unavailable, while zero is a valid probability. The source display
rounding is retained; full-precision calculations belong in the scientific export.

The loader checks the reviewed file checksum, analysis identity, abundance
identities, every frozen membership, all 72 array dimensions/ranges and missing
masks. No output coordinates are imported. A normal update remembers the
supplied population directory and retains its optional supplement. A recipient
without that supplement receives no health-outcome arrays through a code update.
Record-level data and PDF remain outside source Git and external packages unless
separately authorized. The prepared AGP outreach package is unchanged.

## On-demand checks

```sh
node rank2_feature_graph/test_agp_outcomes.cjs
COSMIX_AGP_OUTCOMES=/path/to/supplied/data python3 -m unittest discover -s scripts -p test_agp_outcomes.py
node rank2_feature_graph/test_agp_outcomes_browser.cjs http://127.0.0.1:4173 /path/to/supplied/data
```

The browser test needs the AGP supplement and comb-V3V4-tx as an unaffected
comparison. These checks are outside the update command and run no models.
