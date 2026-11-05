"""Attach a reviewed AGP population to a prepared HTTP viewer."""
import argparse
import json
from pathlib import Path
import re
import tempfile
import portable as p

ID = 'agp-24k-silva'
PIN = 'ef01c7c98a7b262ee6f016d0c5248cdb485027d43d753772e043cb5098a0fd08'
EPOCH500_PIN = '92b4858f2c1e0e6259f05aef5e7a2c9cd3850aa6290e89aed31b821f2c407917'
POPULATION_PINS = {PIN: 'silva-340-epoch200-v1', EPOCH500_PIN: 'silva-340-epoch500-v1'}
EPOCH200_PART = dict(url='/vme-assets/45e92df7d3cc2ea42b9c742d3cfa37336ec1f826642539e187c588b59ba93c71.json',
                     sha256='45e92df7d3cc2ea42b9c742d3cfa37336ec1f826642539e187c588b59ba93c71',bytes=7095026)
REFERENCE_PIN = '77f0276af8e7bffd2f1c433a518040fa81b4398fa37db469c0565093ce1ef499'
LOCAL_ALL_PIN = '49ae4a557268d614e6acbda31c47ee91f7fc1dc966b1e7ad718e702a037ef243'
LOCAL_THROUGH_5006_PIN = 'fbb2f0ea6b59267868e31b684b6ccd7945d4fc97e6045792eafc383c06d5f6fc'
LOCAL_PILOT_PIN = 'f3c5c29a39407c3d6dc83630382592ddca2e941759730dab8dc2c929a90e7fd3'
LOCAL_REVIEWED_PIN = '51473823570462976a9f8a76e20ceb7949ebd7c7e828ffa7b72299ca45645533'
LOCAL_ERROR500_PIN = 'eebb47756393851bbfa4cdd5c30663ace3e30130c8d8b382d9f47323672f4f77'
UNFOLDED_PIN = '874d557c15cc31e96ad4ff2d3cdf56b5a6f0c73ca74b4651c49cb5bfd3da6adc'
UNFOLDED_ERROR500_PIN = '22e7431915fe1bf6b54d60a4092262fbaa9988bb80a80fbcccbacb6fc567d56e'
LAYOUT_PIN = 'b4249fcdcbfa322ad301ff93840593db4b6541bfb8dab8fddfc9e9348dd756a0'


def attach(page, source):
    raw = source.read_bytes()
    revision = POPULATION_PINS.get(p.sha(raw))
    if revision is None or json.loads(raw).get('revision') != revision:
        raise ValueError('AGP population differs from the reviewed epoch-200 or epoch-500 revisions')
    manifest = p.read_manifest(page)
    def publish(raw, ext):
        digest = p.sha(raw)
        descriptor = dict(url='/vme-assets/' + digest + ext, sha256=digest, bytes=len(raw))
        target = p.asset_path(page.parent, descriptor)
        if target.exists():
            p.checked_bytes(page.parent, descriptor)
        else:
            with tempfile.NamedTemporaryFile(dir=target.parent,delete=False) as temp:
                temp.write(raw)
            Path(temp.name).replace(target)
        return descriptor
    entry = dict(capability='agp-population-v1',dataset=dict(id=ID,title='American Gut Project',
                 revision=revision),parts=[publish(b'{"agpPopulation":'+raw+b'}','.json')])
    # Older distributions have the population only. Their diagram still works.
    existing = manifest['datasets'].get(ID)
    accepted = [entry['parts'].copy()]
    references = source.with_name('component-references.json')
    if references.is_file():
        ref_bytes = references.read_bytes()
        if p.sha(ref_bytes) != REFERENCE_PIN:
            raise ValueError('AGP component references differ from the reviewed anchors')
        entry['parts'].append(publish(ref_bytes, '.json'))
    accepted.append(entry['parts'].copy())
    layouts = source.with_name('graph-layouts-3d.json')
    if layouts.is_file():
        layout_bytes = layouts.read_bytes()
        if p.sha(layout_bytes) != LAYOUT_PIN:
            raise ValueError('AGP graph layouts differ from the reviewed revision')
        entry['parts'].append(publish(layout_bytes, '.json'))
    accepted.append(entry['parts'].copy())
    # Newer banks are complete replacements. Accept an upgrade from any reviewed
    # older bank, even when the original file is no longer beside population.json.
    releases = [
        ('local-1cst-pilot.json', LOCAL_PILOT_PIN, 4067864),
        ('local-1cst-all.json', LOCAL_ALL_PIN, 14467743),
        ('local-1cst-through-5006.json', LOCAL_THROUGH_5006_PIN, 15163011),
        ('local-1cst-reviewed.json', LOCAL_REVIEWED_PIN, 15939243),
        ('local-1cst-error500.json', LOCAL_ERROR500_PIN, 15942907),
    ]
    base_parts = entry['parts'].copy()
    for index in reversed(range(len(releases))):
        name, checksum, size = releases[index]
        path = source.with_name(name)
        if not path.is_file():
            continue
        data = path.read_bytes()
        if len(data) != size or p.sha(data) != checksum:
            raise ValueError('AGP local 1-CST bank differs from the reviewed fits')
        for _, previous, length in releases[:index]:
            descriptor = dict(url='/vme-assets/' + previous + '.json', sha256=previous, bytes=length)
            accepted.append(entry['parts'] + [descriptor])
        entry['parts'].append(publish(data, '.json'))
        break
    unfolded = source.with_name('local-1cst-unfolded-error500.json')
    unfolded_pin, ordinary_pin = UNFOLDED_ERROR500_PIN, LOCAL_ERROR500_PIN
    if not unfolded.is_file():
        unfolded = source.with_name('local-1cst-unfolded.json')
        unfolded_pin, ordinary_pin = UNFOLDED_PIN, LOCAL_REVIEWED_PIN
    if unfolded.is_file():
        if entry['parts'][-1]['sha256'] != ordinary_pin:
            raise ValueError('AGP unfolding requires its matching ordinary local bank beside population.json')
        raw_unfolded = unfolded.read_bytes()
        if p.sha(raw_unfolded) != unfolded_pin or json.loads(raw_unfolded)['agpUnfolded']['baseSha'] != ordinary_pin:
            raise ValueError('AGP unfolded 1-CST maps differ from the reviewed revision')
        accepted.append(entry['parts'].copy())
        entry['parts'].append(publish(raw_unfolded, '.json'))
        if unfolded_pin == UNFOLDED_ERROR500_PIN:
            # Permit the exact previously reviewed ordinary+unfolded release.
            accepted.append(base_parts + [
                dict(url='/vme-assets/'+LOCAL_REVIEWED_PIN+'.json', sha256=LOCAL_REVIEWED_PIN, bytes=15939243),
                dict(url='/vme-assets/'+UNFOLDED_PIN+'.json', sha256=UNFOLDED_PIN, bytes=7064531),
            ])
    accepted.append(entry['parts'].copy())
    connections = source.with_name('pure-1cst-connections.json')
    if connections.is_file():
        from agp_connections_supplement import checked_connections
        entry['parts'].append(publish(checked_connections(connections,json.loads(raw)),'.json'))
        accepted.append(entry['parts'].copy())
    merged_connections = source.with_name('merged-1cst-connections.json')
    if merged_connections.is_file():
        if not connections.is_file():
            raise ValueError('AGP merged connections require the matching pure connection supplement')
        from agp_connections_supplement import checked_merged_connections
        entry['parts'].append(publish(checked_merged_connections(merged_connections,json.loads(raw)),'.json'))
        accepted.append(entry['parts'].copy())
    accepted_entries = [{**entry, 'parts': parts} for parts in accepted]
    if revision == POPULATION_PINS[EPOCH500_PIN]:
        accepted_entries += [{**entry, 'dataset': {**entry['dataset'], 'revision': POPULATION_PINS[PIN]},
                              'parts': [EPOCH200_PART]+parts[1:]} for parts in accepted]
    if existing is not None and existing not in accepted_entries:
        raise ValueError('Conflicting AGP dataset revision')
    manifest['datasets'][ID] = entry
    allowed = manifest['seed'].get('distributionDatasets')
    if allowed is not None and ID not in allowed:
        allowed.append(ID)
    viewer = b'(() => {\n' + (p.HERE/'sphere_geometry.js').read_bytes() + b'\n' + (p.HERE/'png_export.js').read_bytes() + b'\n' + (p.HERE/'agp_connections.js').read_bytes() + b'\n' + (p.HERE/'agp_graph_picking.js').read_bytes() + b'\n' + (p.HERE/'agp_population.js').read_bytes()
    manifest['agpViewer'] = publish(viewer + b'\nwindow.showAgpPopulation = showAgpPopulation;\n})();', '.js')
    loader = publish((p.HERE/'asset_loader.js').read_bytes(),'.js')
    html = page.read_text()
    html, n = re.subn(p.PATTERN,lambda _: '<script id="vme-http-manifest" type="application/json">'+
                       p.encoded(manifest).decode().replace('</','<\\/')+'</script>',html,count=1,flags=re.S)
    if n != 1:raise ValueError('Missing HTTP entry')
    html, n = re.subn(r'<script src="/vme-assets/[a-f0-9]{64}\.js"></script>',
                      '<script src="'+loader['url']+'"></script>',html)
    if n != 1:raise ValueError('Ambiguous loader script')
    with tempfile.NamedTemporaryFile('w',dir=page.parent,delete=False) as temp:
        temp.write(html)
    Path(temp.name).replace(page)
    p.write_empty_view(manifest,page.parent/'empty.html',page.name.replace('.http.html','.html'))
    return p.sha(p.encoded([entry, manifest['agpViewer'], loader]))


if __name__=='__main__':
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('page',type=Path)
    parser.add_argument('population',type=Path)
    args=parser.parse_args()
    attach(args.page,args.population)
