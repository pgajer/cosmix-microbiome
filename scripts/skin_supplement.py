"""Attach externally reviewed skin v2 exchanges to an HTTP viewer, without fitting."""
import json
from pathlib import Path
import re
import tempfile

import portable as p
from skin_exchange_v2 import read_bundle

# Reviewed production revisions only. Synthetic fixtures use a separate catalogue.
REGISTRY = {'skin1975-1841': {'datasetId': 'skin1975-1841',
                   'studyId': '1841',
                   'title': 'Huang collection · Flores temporal skin',
                   'revision': 'exploratory-v2-20261105-1',
                   'capability': 'skin-population-v2',
                   'manifestSha256': 'f59c60044b971457e8c068a3f4e14b5259ae62517faad8225a0e63a667479a4e'},
 'skin1975-10317': {'datasetId': 'skin1975-10317',
                    'studyId': '10317',
                    'title': 'Huang collection · American Gut skin subset',
                    'revision': 'exploratory-v2-20261105-1',
                    'capability': 'skin-population-v2',
                    'manifestSha256': '6ca6ccac78bbd2171399e29012e7bb150ab9f9a965252798b4a0229d8aedbb7b'},
 'skin1975-2010': {'datasetId': 'skin1975-2010',
                   'studyId': '2010',
                   'title': 'Huang collection · Maternal forehead',
                   'revision': 'exploratory-v2-20261105-1',
                   'capability': 'skin-population-v2',
                   'manifestSha256': '38714d7a168a5e5d843e1305ea2ad3d49790bf857683d2825f13eb32eb9a342a'},
 'skin1975-11052': {'datasetId': 'skin1975-11052',
                    'studyId': '11052',
                    'title': 'Huang collection · ABTX',
                    'revision': 'exploratory-v2-20261105-1',
                    'capability': 'skin-population-v2',
                    'manifestSha256': 'efca4f869f721b07d03f5d4a76d55cd57fbb942a4c5cd3b083a57571169f8c60'},
 'skin10894-infant-forearm': {'datasetId': 'skin10894-infant-forearm',
                              'studyId': '10894',
                              'title': 'Study 10894 · Infant forearm',
                              'revision': 'exploratory-v2-20261105-1',
                              'capability': 'skin-population-v2',
                              'manifestSha256': 'c867aea19db68a374e1e858fd571c6137407682c6f029c244cd7a07bc91715fd'},
 'skin10894-maternal-forearm': {'datasetId': 'skin10894-maternal-forearm',
                                'studyId': '10894',
                                'title': 'Study 10894 · Maternal forearm',
                                'revision': 'exploratory-v2-20261105-1',
                                'capability': 'skin-population-v2',
                                'manifestSha256': 'eb8a7be30edee414f1e0675a2d7e8b65ade5a25bf6b59deae2c17d30a414ae2d'},
 'skin10894-maternal-areola': {'datasetId': 'skin10894-maternal-areola',
                               'studyId': '10894',
                               'title': 'Study 10894 · Maternal right areola',
                               'revision': 'exploratory-v2-20261105-1',
                               'capability': 'skin-population-v2',
                               'manifestSha256': 'b1d8f6523a9c4a93815045e1dd739d3a8c6a328c87f60654657cf9ffe5b8ac6d'}}


def population(directory, registry=None):
    directory = Path(directory)
    data, manifest = read_bundle(directory)
    entry = (REGISTRY if registry is None else registry).get(manifest['datasetId'])
    identity = {k: manifest[k] for k in ('datasetId', 'studyId', 'title', 'revision', 'capability')}
    identity['manifestSha256'] = p.sha((directory / 'manifest.json').read_bytes())
    if entry != identity or manifest['synthetic']:
        raise ValueError('Skin exchange is not a registered production revision')
    eligible = [e for e in data['eligibility.json'] if e['embeddingEligible']]
    return dict(id=manifest['datasetId'], revision=manifest['revision'], title=manifest['title'],
                studyId=manifest['studyId'], capability=manifest['capability'],
                synthetic=False, records=data['records.json'], eligibility=eligible,
                pairs=data['pairs.json'], banks={m: data[m+'.json'] for m in manifest['methods']},
                exploratory=manifest['exploratory'], timing=data['provenance.json']['timing'],
                pairPolicy=manifest['pairPolicy'])


def viewer_bytes():
    return ((p.HERE/'skin_population.js').read_bytes() + b'\n' +
            (p.HERE/'skin_population_v2.js').read_bytes())


def prepare_catalog(common_app, directories, output):
    """Create a selectable, skin-only release using a verified installed runtime."""
    import meeting_release as release
    from skin_exchange import write_file
    base = p.read_manifest(common_app/'web/index.html')
    plotly = base['plotly']
    plotly_bytes = p.checked_bytes(common_app/'web', plotly)
    populations = [population(d) for d in directories]
    if not populations or len({d['id'] for d in populations}) != len(populations):
        raise ValueError('Choose distinct skin populations')
    if output.exists():
        raise ValueError('Choose a new catalogue directory')
    output.parent.mkdir(parents=True, exist_ok=True)
    with tempfile.TemporaryDirectory(dir=output.parent) as tmp:
        root = Path(tmp)/'release'
        write_file(root, 'common'+plotly['url'], plotly_bytes)
        catalog = dict(format=release.FORMAT, version=1, release='skin-v2-exploratory-20261105',
                       common=write_file(root, 'common/manifest.json', p.encoded(dict(seed={}, plotly=plotly))),
                       server=write_file(root, 'common/vme-server', (common_app/'vme-server').read_bytes()), datasets={})
        for data in populations:
            raw=p.encoded(dict(skinPopulation=data));digest=p.sha(raw);url='/vme-assets/'+digest+'.json'
            folder='datasets/'+data['id'];write_file(root,folder+url,raw)
            entry=dict(capability='skin-population-v2',dataset=dict(id=data['id'],title=data['title'],
                       revision=data['revision'],description=data['exploratory']['notice']),
                       parts=[dict(url=url,bytes=len(raw),sha256=digest)])
            descriptor=write_file(root,folder+'/manifest.json',p.encoded(dict(release=catalog['release'],id=data['id'],dataset=entry,seed={})))
            catalog['datasets'][data['id']]=dict(title=data['title'],manifest=descriptor,archive=data['id']+'.zip')
        write_file(root,'catalog.json',p.encoded(catalog))
        root.rename(output)


def attach(page, directories):
    """Prepare all inputs before replacing the candidate manifest atomically."""
    populations = [population(d) for d in directories]
    if not populations or len({d['id'] for d in populations}) != len(populations):
        raise ValueError('Choose distinct registered skin populations')
    manifest = p.read_manifest(page)
    def publish(raw, suffix):
        digest = p.sha(raw)
        descriptor = dict(url='/vme-assets/'+digest+suffix, sha256=digest, bytes=len(raw))
        target = p.asset_path(page.parent, descriptor)
        target.parent.mkdir(parents=True, exist_ok=True)
        if target.exists():
            p.checked_bytes(page.parent, descriptor)
        else:
            with tempfile.NamedTemporaryFile(dir=target.parent, delete=False) as f:
                f.write(raw)
            Path(f.name).replace(target)
        return descriptor
    entries = []
    for data in populations:
        entry = dict(capability='skin-population-v2', dataset=dict(id=data['id'], title=data['title'],
                     revision=data['revision'], description=data['exploratory']['notice']),
                     parts=[publish(p.encoded(dict(skinPopulation=data)), '.json')])
        old = manifest['datasets'].get(data['id'])
        if old is not None and old != entry:
            raise ValueError('Conflicting installed skin revision: '+data['id'])
        manifest['datasets'][data['id']] = entry
        allowed = manifest['seed'].get('distributionDatasets')
        if allowed is not None and data['id'] not in allowed:
            allowed.append(data['id'])
        entries.append(entry)
    manifest['skinViewer'] = publish(viewer_bytes(), '.js')
    loader = publish((p.HERE/'asset_loader.js').read_bytes(), '.js')
    html, n = re.subn(p.PATTERN, lambda _: '<script id="vme-http-manifest" type="application/json">'+
                     p.encoded(manifest).decode().replace('</', '<\\/')+'</script>', page.read_text(), count=1, flags=re.S)
    if n != 1:
        raise ValueError('Missing HTTP manifest')
    html, n = re.subn(r'<script src="/vme-assets/[a-f0-9]{64}\.js"></script>',
                     '<script src="'+loader['url']+'"></script>', html)
    if n != 1:
        raise ValueError('Ambiguous HTTP loader')
    with tempfile.NamedTemporaryFile('w', dir=page.parent, delete=False) as f:
        f.write(html)
    Path(f.name).replace(page)
    p.write_empty_view(manifest, page.parent/'empty.html', page.name.replace('.http.html', '.html'))
    return p.sha(p.encoded([entries, manifest['skinViewer'], loader]))
