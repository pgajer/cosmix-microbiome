"""Validate and attach reviewed genus-state annotations; never fit or reassign."""
from collections import Counter
import json
import math
from pathlib import Path
import re

import portable as p
from skin_supplement import REGISTRY

MANIFEST_SHA256 = 'e937e49f121fbb36ac1dc870aeaf91dadee46a3261c7de95cf9628115d51d67f'
QS = [60, 70, 80, 90, 100]


def require(ok, message):
    if not ok:
        raise ValueError('Skin state supplement: '+message)


def read(directory):
    directory = Path(directory)
    raw = (directory/'manifest.json').read_bytes()
    require(p.sha(raw) == MANIFEST_SHA256, 'unreviewed manifest')
    manifest = json.loads(raw)
    require(manifest['format'] == 'cosmix-skin-genus-states' and manifest['version'] == 1 and
            manifest['coverages'] == QS, 'unsupported format')
    def checked(d):
        require(Path(d['file']).name == d['file'], 'invalid file path')
        content = (directory/d['file']).read_bytes()
        require(len(content) == d['bytes'] and p.sha(content) == d['sha256'], 'file checksum mismatch')
        return json.loads(content)
    verified = checked(manifest['verification'])
    require(verified['status'] == 'PASS', 'producer verification did not pass')
    populations = {key: checked(d) for key, d in manifest['populations'].items()}
    for key, data in populations.items():
        require(data['datasetId'] == key and data['revision'] == manifest['revision'], 'population identity')
        validate(data)
    return populations


def validate(data, population=None):
    registry = REGISTRY.get(data['datasetId'])
    require(registry and data['baseRevision'] == registry['revision'] and
            data['baseManifestSha256'] == registry['manifestSha256'], 'base exchange identity')
    ids = data['sampleIds']; n = len(ids)
    require(n > 0 and len(set(ids)) == n and all(isinstance(x, str) for x in ids), 'sample IDs')
    if population is not None:
        require(data['datasetId'] == population['id'] and data['baseRevision'] == population['revision'] and
                ids == [r['specimenId'] for r in population['records']], 'sample identity or order')
    categories = data['categories']; by_id = {c['id']: c for c in categories}
    require(len(by_id) == len(categories), 'duplicate category')
    for c in categories:
        require(c['rank'] in ('genus', 'higher', 'unassigned') and isinstance(c['label'], str) and c['label'], 'category label/rank')
        v = c['totalRelativeAbundance']
        require(type(v) in (int, float) and math.isfinite(v) and v >= 0, 'category abundance')
    require(math.isclose(sum(c['totalRelativeAbundance'] for c in categories), n, abs_tol=1e-7), 'abundance total')
    states = data['states']; pure = data['pure']; counts = Counter(pure)
    require(len(pure) == n and set(counts) == set(states), 'pure partition')
    def pair(key):
        require(re.fullmatch(r'[1-9][0-9]*,[1-9][0-9]*', key), 'pair key')
        a, b = map(int, key.split(','))
        require(1 <= a < b <= len(categories), 'pair indices')
        return a, b
    for key, state in states.items():
        ii = pair(key)
        ordered = sorted(ii, key=lambda i: (-categories[i-1]['totalRelativeAbundance'], i))
        require(state['components'] == [categories[i-1]['id'] for i in ordered] and
                state['label'] == ' + '.join(categories[i-1]['label'] for i in ordered), 'pair display order')
        require(type(state['pureCount']) is int and state['pureCount'] == counts[key], 'pure count')
    require(set(data['levels']) == set(map(str, QS)), 'coverage levels')
    order = sorted(counts, key=lambda k: (-counts[k], pair(k)))
    for q in QS:
        level = data['levels'][str(q)]; cumulative = 0
        for key in order:
            cumulative += counts[key]
            if cumulative*100 >= q*n:
                cutoff = counts[key]; break
        cores = [key for key in order if counts[key] >= cutoff]
        require(level['cores'] == cores, 'core selection or frequency tier')
        core_count = sum(counts[k] for k in cores)
        require(level['coreCount'] == core_count and math.isclose(level['achievedCoverage'], 100*core_count/n, abs_tol=1e-8), 'coverage count')
        assigned, routes = level['assignments'], level['methods']
        require(len(assigned) == len(routes) == n and set(assigned) <= set(cores), 'assigned partition')
        direct = {}
        for original, group, route in zip(pure, assigned, routes):
            require(route in ('core', 'rank3', 'knn'), 'assignment route')
            require((route == 'core') == (original in cores), 'core route')
            if route == 'core': require(group == original, 'changed original core')
            if route == 'rank3':
                require(direct.setdefault(original, group) == group, 'inconsistent direct bridge')
    require(data['provenance']['countingUnit'] == 'specimens' and
            data['provenance']['assignmentGeometry'] == 'genus-pooled L1 Euclidean', 'assignment meaning')


def attach(page, directory):
    populations = read(directory)
    manifest = p.read_manifest(page)
    updated = {}
    for key, entry in manifest['datasets'].items():
        if entry.get('capability') != 'skin-population-v2': continue
        require(key in populations, 'missing installed population')
        parts = []
        population = None
        for descriptor in entry['parts']:
            value = json.loads(p.checked_bytes(page.parent, descriptor))
            if 'skinPopulation' in value: population = value['skinPopulation']
            if 'skinStates' not in value: parts.append(descriptor)
        require(population is not None, 'missing original population payload')
        validate(populations[key], population)
        raw = p.encoded(dict(skinStates=populations[key])); digest = p.sha(raw)
        descriptor = dict(url='/vme-assets/'+digest+'.json', sha256=digest, bytes=len(raw))
        updated[key] = (entry, parts+[descriptor], descriptor, raw)
    require(updated, 'no matching installed skin populations')
    # Inputs all pass before publishing immutable assets and the new manifest.
    for entry, parts, descriptor, raw in updated.values():
        path = p.asset_path(page.parent, descriptor); path.parent.mkdir(parents=True, exist_ok=True)
        if path.exists(): p.checked_bytes(page.parent, descriptor)
        else: path.write_bytes(raw)
        entry['parts'] = parts
    text = page.read_text()
    replacement = '<script id="vme-http-manifest" type="application/json">'+p.encoded(manifest).decode()+'</script>'
    text, count = re.subn(r'<script id="vme-http-manifest" type="application/json">.*?</script>', lambda _: replacement, text, flags=re.S)
    require(count == 1, 'manifest element')
    temporary = page.with_name(page.name+'.skin-states.tmp'); temporary.write_text(text); temporary.replace(page)
    return p.sha(p.encoded({k: entry['parts'] for k, entry in manifest['datasets'].items() if k in updated}))
