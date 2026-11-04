"""Attach the reviewed AGP epoch-200 population to a prepared HTTP viewer."""
import argparse
from pathlib import Path
import re
import tempfile
import portable as p

ID = 'agp-24k-silva'
PIN = 'ef01c7c98a7b262ee6f016d0c5248cdb485027d43d753772e043cb5098a0fd08'


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
    if ID in manifest['datasets'] and manifest['datasets'][ID] != entry:
        raise ValueError('Conflicting AGP dataset revision')
    manifest['datasets'][ID] = entry
    allowed = manifest['seed'].get('distributionDatasets')
    if allowed is not None and ID not in allowed:
        allowed.append(ID)
    manifest['agpViewer'] = publish((p.HERE/'agp_population.js').read_bytes(),'.js')
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
