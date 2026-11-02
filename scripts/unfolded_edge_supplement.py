"""Admit complete, separately supplied edge-unfolding banks without fitting.

The reviewed ZAPPS, LSVF, HMP 40, HMP 152, SANTE, PAPCLEAR and combined V4 population resolvers are supported. The offline
verifier checks numerical error and runtime provenance independently; this reader
checks scientific context, coordinate integrity and duplicate expansion.
"""
import base64
import json
import math
import struct
from dataset_maxnorm_supplement import digest

POLICY = 'dataset-observation-original-relative-abundance-v1'
TARGET = 'Euclidean distances after anchor-centered face rotation, without stretching'


def key(parts):
    return json.dumps(parts, separators=(',', ':'))


def selections(bundle):
    """Resolve exact record indices from frozen source selections, not coordinates."""
    if bundle['dataset']['id'] not in {'zapps-pressmat-v4', 'lsvf-v3v4-20241111', 'umb-hmp-2019-panel', 'hmp-u01-2019', 'sante-16s', 'papclear-v3v4-provisional-20261017', 'comb-V4-tx'}:
        raise ValueError('Unfolded edge supplement: population resolver not reviewed for this dataset')
    data, analysis = bundle['data'], bundle['cohortAnalysis']
    if analysis.get('eligibility') or analysis.get('combDisplay'):
        raise ValueError('Unfolded edge supplement: unsupported eligibility resolver')
    records = analysis['records']
    def indices(values):
        if (not isinstance(values, list) or
                any(type(i) is not int or not 0 <= i < len(records) for i in values) or
                len(values) != len(set(values))):
            raise ValueError('Unfolded edge supplement: invalid source record indices')
        return sorted(values)
    populations = {}
    for cohort, population in analysis['populations'].items():
        if 'recordIndices' in population:
            # Assay subsets take precedence over their source-cohort annotation.
            ii = indices(population['recordIndices'])
        else:
            sources = population.get('sourceCohorts') or [cohort]
            ii = [i for i, r in enumerate(records) if cohort == 'all' or r['cohort'] in sources]
        populations[cohort] = ii
    if populations.get('all') != list(range(len(records))):
        raise ValueError('Unfolded edge supplement: full source population differs')
    result = {}
    for q, graph in data['graphs'].items():
        for edge in graph['edges']:
            eid = edge['id']
            pp = set(data['localEmbeddings'][eid]['indices'])
            ii = [i for i, r in enumerate(records) if r['profile'] in pp]
            if ii:
                result[key(['all', 'pure', str(q), 'group', eid])] = ii
    for spec in analysis['specs'].values():
        population = indices(spec['population'])
        if population != populations.get(spec['cohort']):
            raise ValueError('Unfolded edge supplement: source population differs from recorded cohort or assay subset')
        labels = analysis['merged'][str(spec['q'])]['pairs'] if spec['mode'] == 'merged' else data['samples']['pair']
        for eid, fit_id in spec['states'].items():
            ii = population
            ii = [i for i in ii if labels[records[i]['profile']] == eid]
            fit = analysis['fits'][fit_id]
            if set(ii) != set(fit['indices']) or sorted({records[i]['profile'] for i in ii}) != sorted(fit['profileIndices']):
                raise ValueError('Unfolded edge supplement: source selection membership differs')
            if ii:
                result.setdefault(key([spec['cohort'], spec['mode'], str(spec['q']), 'group', eid]), ii)
    return result


def rotated_row(row, anchor):
    values = dict(row)
    maximum = max(values.values())
    values = {j: v / maximum for j, v in values.items() if v > 0}
    face = anchor if values.get(anchor) == 1 else min(j for j, v in values.items() if v == 1)
    if face != anchor:
        values[face] = 2 - values.get(anchor, 0)
    values.pop(anchor, None)
    return tuple(sorted(values.items()))


def validate(asset, bundle, participants, *, allow_partial=False):
    def require(ok, message):
        if not ok:
            raise ValueError('Unfolded edge supplement: ' + message)
    require(asset.get('version') == 1, 'unsupported format')
    require((asset.get('dataset'), asset.get('baseRevision'), asset.get('analysisRevision')) ==
            (bundle['dataset']['id'], bundle['dataset']['revision'], participants['analysisRevision']), 'release identity differs')
    require(asset['revision'] == digest({k: v for k, v in asset.items() if k != 'revision'}), 'content checksum differs')
    require(asset['featureOrderSha256'] == digest(participants['features']), 'feature order differs')
    require(asset['settings']['targets'] == TARGET, 'target geometry differs')
    scope = asset['scope']
    require(scope.get('kind') == 'edge' and scope.get('anchors') == 'both-endpoints' and isinstance(scope.get('complete'), bool), 'invalid scope')
    require(scope['complete'] or allow_partial, 'partial pilot bank is not a production supplement')
    for name in ('cohorts', 'modes', 'coverages'):
        require(isinstance(scope.get(name), list) and scope[name] and len(scope[name]) == len(set(scope[name])), 'invalid scope ' + name)
    require(set(scope['cohorts']) <= set(bundle['cohortAnalysis']['populations']) and set(scope['modes']) <= {'pure','merged'} and set(scope['coverages']) <= set(bundle['data']['graphs']), 'unknown scope')
    all_selections = selections(bundle)
    expected = {k: v for k, v in all_selections.items() if all(x in scope[n] for x, n in zip(json.loads(k)[:3], ('cohorts','modes','coverages')))}
    require(not scope['complete'] or set(expected) == set(all_selections), 'complete bank omits supported source contexts')
    actual = asset['selections']
    require(bool(actual) and (set(actual) == set(expected) if scope['complete'] else set(actual) <= set(expected)), 'selection scope incomplete or foreign')
    analysis_records = bundle['cohortAnalysis']['records']
    records = participants['records']
    require(len({r['id'] for r in records}) == len(records) and len({r['id'] for r in analysis_records}) == len(analysis_records), 'duplicate source record IDs')
    require({r['id']: r['profile'] for r in records} == {r['id']: r['profile'] for r in analysis_records}, 'participant and analysis populations differ')
    rows = participants['compositions']
    require(all(str(r['profile']) in rows for r in records), 'missing source compositions')
    compositions = {p: dict(row) for p, row in rows.items()}
    require(all(len(row) == len(compositions[p]) and all(isinstance(j, int) and 0 <= j < len(participants['features']) and math.isfinite(v) and v >= 0 for j, v in row) and abs(math.fsum(v for _, v in row)-1) < 1e-10 for p, row in rows.items()), 'invalid full-composition relative abundances')
    totals = [math.fsum(compositions[str(r['profile'])].get(j, 0) for r in records) for j in range(len(participants['features']))]
    abundance_basis = dict(population='all-eligible-dataset-records', normalization='full-composition-sum-to-one',
        recordOrder='participants.records source order', recordMapSha256=digest([[r['id'], r['profile']] for r in records]),
        compositionsSha256=digest(rows), totalsSha256=digest(totals))
    total_ids = digest([r['id'] for r in records])
    required_contexts, required_fits = set(), set()
    for context, entry in actual.items():
        fields = json.loads(context)
        edge = fields[4]
        endpoints = list(map(int, edge.split(',')))
        require(len(endpoints) == 2 and endpoints == sorted(set(endpoints)) and all(1 <= e <= len(totals) for e in endpoints), 'invalid endpoints')
        ii = expected[context]
        selected_ids = {analysis_records[i]['id'] for i in ii}
        selected = [r for r in records if r['id'] in selected_ids]
        pp = sorted({r['profile'] for r in selected})
        require(entry['endpoints'] == endpoints and entry['profiles'] == pp and entry['membershipSha256'] == digest(pp), 'edge membership differs')
        require(entry['observations'] == len(ii) and entry['recordIdsSha256'] == digest([r['id'] for r in selected]), 'edge record membership differs')
        require(entry['totalObservations'] == len(records) and entry['totalRecordIdsSha256'] == total_ids and entry['defaultAnchorPolicy'] == POLICY, 'default anchor population differs')
        require(entry.get('abundanceBasis') == abundance_basis, 'abundance basis differs')
        require(len(entry['endpointTotals']) == 2 and all(math.isclose(a, totals[e-1], rel_tol=1e-12, abs_tol=1e-10) for a,e in zip(entry['endpointTotals'], endpoints)), 'default anchor abundance totals differ')
        default = min(endpoints, key=lambda e: (-totals[e-1], e))
        require(entry['defaultAnchorFeatureId'] == default, 'default anchor differs')
        for endpoint in endpoints:
            ctx = key(fields + [str(endpoint)])
            fit_key = digest(dict(edge=edge, anchor=endpoint-1, profiles=pp)) + ':euclidean'
            required_contexts.add(ctx);required_fits.add(fit_key)
            require(asset['contexts'].get(ctx) == fit_key and fit_key in asset['fits'], 'missing endpoint or foreign fit')
            fit = asset['fits'][fit_key]
            require(fit['edge'] == edge and fit['anchor'] == endpoint-1 and fit['profiles'] == pp, 'fit edge/anchor/membership differs')
            receipt = {name: asset[name] for name in ('dataset','baseRevision','analysisRevision','inputs','featureOrderSha256','settings')}
            receipt.update(context=fields+[str(endpoint)], selection=entry, fitKey=fit_key, fitReceipt=fit['receipt'])
            require(asset['contextReceipts'].get(ctx) == digest(receipt), 'context receipt differs')
    require(set(asset['contexts']) == required_contexts and set(asset['contextReceipts']) == required_contexts, 'extra or missing contexts')
    require(set(asset['fits']) == required_fits, 'unused or missing fits')
    for fit in asset['fits'].values():
        require(fit['receipt'] == digest({k: v for k, v in fit.items() if k != 'receipt'}), 'fit checksum differs')
        require(fit['metric'] == 'euclidean' and fit['coordinateEncoding'] == 'float64-le-base64', 'unsupported coordinates')
        raw = base64.b64decode(fit['coordinates'], validate=True)
        require(len(raw) == len(fit['profiles']) * 24, 'coordinate length differs')
        xyz = list(struct.iter_unpack('<3d', raw))
        require(all(math.isfinite(v) for point in xyz for v in point), 'nonfinite coordinates')
        distinct = {}
        for profile, point in zip(fit['profiles'], xyz):
            target = rotated_row(rows[str(profile)], fit['anchor'])
            require(target not in distinct or distinct[target] == point, 'duplicate targets have different coordinates')
            distinct[target] = point
        n = len(distinct);score = fit['evaluation'];solver = fit['solver'];seeds = fit['validation']['seeds']
        require(score['profiles'] == n, 'distinct target count differs')
        require((score['relativeRms'] is None and score['pairs'] == 0) if n == 1 else isinstance(score['relativeRms'], (int,float)) and math.isfinite(score['relativeRms']) and score['relativeRms'] >= 0, 'invalid distance diagnostic')
        require(solver['backend'] == 'analytic' if n < 3 else solver['backend'] == 'sgd' and solver['epochs'] == 200 and solver['seed'] in (17,29), 'solver receipt differs')
        if n >= 3:
            require(len(seeds) == 2 and {v['seed'] for v in seeds} == {17,29} and all(isinstance(v['relativeRms'],(int,float)) and math.isfinite(v['relativeRms']) and v['relativeRms'] >= 0 for v in seeds), 'missing start diagnostics')
            require(score['relativeRms'] == min(v['relativeRms'] for v in seeds), 'chosen start differs')
        require(bool(fit.get('provenance', {}).get('run')) and bool(fit['provenance'].get('runtime')), 'missing numerical provenance')
    return asset
