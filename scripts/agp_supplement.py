"""Attach the reviewed AGP epoch-200 population to a prepared HTTP viewer."""
import argparse
from pathlib import Path
import re
import tempfile
import portable as p

ID = 'agp-24k-silva'
PIN = 'ef01c7c98a7b262ee6f016d0c5248cdb485027d43d753772e043cb5098a0fd08'
REFERENCE_PIN = '77f0276af8e7bffd2f1c433a518040fa81b4398fa37db469c0565093ce1ef499'
LOCAL_ALL_PIN = '49ae4a557268d614e6acbda31c47ee91f7fc1dc966b1e7ad718e702a037ef243'
LOCAL_PILOT_PIN = 'f3c5c29a39407c3d6dc83630382592ddca2e941759730dab8dc2c929a90e7fd3'
LAYOUT_PIN = 'b4249fcdcbfa322ad301ff93840593db4b6541bfb8dab8fddfc9e9348dd756a0'


def attach(page, source):
    raw = source.read_bytes()
    if p.sha(raw) != PIN:
        raise ValueError('AGP population differs from the reviewed epoch-200 revision')
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
                 revision='silva-340-epoch200-v1'),parts=[publish(b'{"agpPopulation":'+raw+b'}','.json')])
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
    pilot = source.with_name('local-1cst-pilot.json')
    complete = source.with_name('local-1cst-all.json')
    if complete.is_file():
        full_bytes = complete.read_bytes()
        if p.sha(full_bytes) != LOCAL_ALL_PIN:
            raise ValueError('AGP local 1-CST bank differs from the reviewed fits')
        # An existing pilot installation may upgrade directly to the complete bank.
        pilot_descriptor = dict(url='/vme-assets/' + LOCAL_PILOT_PIN + '.json',
                                sha256=LOCAL_PILOT_PIN, bytes=4067864)
        accepted.append(entry['parts'] + [pilot_descriptor])
        entry['parts'].append(publish(full_bytes, '.json'))
    elif pilot.is_file():
        pilot_bytes = pilot.read_bytes()
        if p.sha(pilot_bytes) != LOCAL_PILOT_PIN:
            raise ValueError('AGP local 1-CST pilot differs from the reviewed fits')
        entry['parts'].append(publish(pilot_bytes, '.json'))
    accepted.append(entry['parts'])
    if existing is not None and not any(existing == {**entry, 'parts': parts} for parts in accepted):
        raise ValueError('Conflicting AGP dataset revision')
    manifest['datasets'][ID] = entry
    allowed = manifest['seed'].get('distributionDatasets')
    if allowed is not None and ID not in allowed:
        allowed.append(ID)
    viewer = b'(() => {\n' + (p.HERE/'sphere_geometry.js').read_bytes() + b'\n' + (p.HERE/'png_export.js').read_bytes() + b'\n' + (p.HERE/'agp_population.js').read_bytes()
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
