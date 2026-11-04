"""Adapt reviewed skin population exchanges to a selectable CoSMiX data release."""
import argparse
from collections import defaultdict
import json
from pathlib import Path
from tempfile import TemporaryDirectory

import portable as p
import meeting_release as release

# External admission pins, reviewed against the producer's v1 semantic verifier.
# Production revisions require a separate scientific review and registry entry.
FIXTURES = {
    'fixture-eat-skin': '371db135f7386cad77c85356a621f39aca9adeb945f224628316e33a577d520b',
    'fixture-copsac2010-skin': '7c3fb1a0d2f7b4d58433ced65b6ce9c54c8a58c14361b26ad7aafa09833d0113',
}
METHODS = ('l1-euclidean', 'max-euclidean', 'max-linf')


def unique_object(items):
    result = dict(items)
    if len(result) != len(items):
        raise ValueError('Duplicate JSON key')
    return result


def read_json(raw):
    return json.loads(raw.decode('utf-8'), object_pairs_hook=unique_object)


def adapt(directory):
    if directory.is_symlink() or any(f.is_symlink() or not f.is_file() for f in directory.iterdir()):
        raise ValueError('Exchange requires regular files')
    raw = (directory / 'manifest.json').read_bytes()
    manifest = read_json(raw)
    identifier = manifest['datasetId']
    if FIXTURES.get(identifier) != p.sha(raw):
        raise ValueError('Unreviewed skin exchange manifest')
    if (manifest['format'], manifest['schemaVersion'], manifest['capability'], manifest['synthetic']) != (
            'cosmix-skin-exchange', '1', 'population-only', True):
        raise ValueError('Unsupported exchange')
    files = {f['path']: f for f in manifest['files']}
    if {f.name for f in directory.iterdir()} != set(files) | {'manifest.json'}:
        raise ValueError('Unexpected or missing exchange file')
    data = {name: read_json(release.checked_file(directory, desc)) for name, desc in files.items()}
    records = data['records.json']
    ids = {r['specimenId'] for r in records}
    eligible = {r['specimenId'] for r in data['eligibility.json'] if r['eligible'] and r['role'] == 'skin-swab'}
    if len(ids) != len(records) or ids != eligible or ids != data['counts.json']['counts'].keys():
        raise ValueError('Inconsistent eligible specimens')
    groups = defaultdict(list)
    for r in records:
        groups[r['participantId'], r['site']].append((r['visitOrder'], r['specimenId']))
    expected = {tuple(i for _, i in sorted(rows)) for rows in groups.values() if len(rows) > 1}
    pairs = data['pairs.json']
    if len(expected) != len(pairs) or expected != set(map(tuple, pairs)):
        raise ValueError('Invalid same-site pairs')
    banks = {}
    for method in METHODS:
        bank = data[method + '.json']
        if (bank['datasetId'], bank['revision'], bank['method'], bank['context']) != (
                identifier, manifest['revision'], method, 'population') or bank['coordinates'].keys() != ids:
            raise ValueError('Invalid population bank')
        banks[method] = bank
    # Retain all eligible rows; withheld and QC-only accessions never enter browser data.
    return dict(id=identifier, revision=manifest['revision'], cohort=manifest['cohort'],
                synthetic=manifest['synthetic'], records=records, pairs=pairs, banks=banks)


def write_file(root, relative, raw):
    path = root / relative
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_bytes(raw)
    return dict(path=relative, bytes=len(raw), sha256=p.sha(raw))


def prepare_fixture_catalog(common_release, exchanges, output):
    """Copy only the common viewer runtime. Publish all cohort packages atomically."""
    base = release.read_catalog(common_release)
    common = read_json(release.checked_file(common_release, base['common']))
    plotly = common['plotly']
    output.parent.mkdir(parents=True, exist_ok=True)
    if output.exists():
        raise ValueError('Choose a new catalogue directory')
    with TemporaryDirectory(dir=output.parent) as tmp:
        root = Path(tmp) / 'release'
        write_file(root, 'common' + plotly['url'], p.checked_bytes(common_release / 'common', plotly))
        catalog = dict(format=release.FORMAT, version=1, release='skin-fixtures-v1',
                       common=write_file(root, 'common/manifest.json', p.encoded(dict(seed={}, plotly=plotly))),
                       server=write_file(root, 'common/vme-server', release.checked_file(common_release, base['server'])),
                       datasets={}, synthetic=True)
        for directory in exchanges:
            population = adapt(directory)
            identifier = population['id']
            if identifier in catalog['datasets']:
                raise ValueError('Duplicate cohort exchange')
            title = {'EAT': 'EAT', 'COPSAC': 'COPSAC 2010'}[population['cohort']] + ' skin (synthetic)'
            raw = p.encoded(dict(skinPopulation=population))
            folder = 'datasets/' + identifier
            digest = p.sha(raw)
            url = '/vme-assets/' + digest + '.json'
            write_file(root, folder + url, raw)
            entry = dict(dataset=dict(id=identifier, title=title, revision=population['revision']),
                         capability='skin-population-v1', parts=[dict(url=url, bytes=len(raw), sha256=digest)])
            part = dict(release=catalog['release'], id=identifier, dataset=entry, seed={})
            manifest = write_file(root, folder + '/manifest.json', p.encoded(part))
            catalog['datasets'][identifier] = dict(title=title, manifest=manifest, archive=identifier + '.zip')
        write_file(root, 'catalog.json', p.encoded(catalog))
        root.rename(output)


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--common-release', required=True, type=Path)
    parser.add_argument('--fixture', required=True, nargs='+', type=Path)
    parser.add_argument('--output', required=True, type=Path)
    args = parser.parse_args()
    prepare_fixture_catalog(args.common_release, args.fixture, args.output)
