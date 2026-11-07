"""A data-free presentation shell, built from the same HTML/CSS as the explorer."""
from html import escape
from pathlib import Path
import re
import os
import tempfile

HERE = Path(__file__).resolve().parent


def replace_element(page, identifier, replacement=''):
    """Replace one complete HTML element, including nested elements of its tag."""
    opening = re.search(r'<([\w-]+)\b[^>]*\bid="' + re.escape(identifier) + r'"[^>]*>', page)
    if not opening:
        raise ValueError('Missing presentation element: ' + identifier)
    depth = 1
    for token in re.finditer(r'</?' + opening[1] + r'\b[^>]*>', page[opening.end():]):
        depth += -1 if token[0].startswith('</') else 1
        if not depth:
            return page[:opening.start()] + replacement + page[opening.end()+token.end():]
    raise ValueError('Unclosed presentation element: ' + identifier)


def render_empty_view(manifest, entry='index.html'):
    # Never derive this page from an assembled viewer: that embeds scientific
    # supplements and report PDFs even before the HTTP loader runs.
    page = (HERE / 'viewer.html').read_text().split('<script>\nconst BUNDLE_PACK=', 1)[0]
    if '/*BUNDLES*/' in page or '<body>' not in page:
        raise ValueError('Viewer shell boundary changed')
    page = re.sub(r'<script\b[^>]*>.*?</script>', '', page, flags=re.S)
    page = re.sub(r'<dialog\b[^>]*>.*?</dialog>', '', page, flags=re.S)
    page = re.sub(r'\s+on\w+="[^"]*"', '', page)
    page = re.sub(r'<title>.*?</title>', '<title>MiCOVE — Empty</title>', page)
    for identifier in ('populationComparisonControl', 'datasetMethodsPanel', 'sampleControls',
                       'panelSampleControls', 'participantProjectControl', 'participantSwitchHelp',
                       'selectionPanel', 'stateTransitions', 'legacyLinks'):
        page = replace_element(page, identifier)
    seed = manifest.get('seed', {})
    choices = [(item['dataset']['id'], seed.get('datasetPresentation', {}).get(item['dataset']['id'], {}).get('title') or item['dataset'].get('title') or item['dataset']['id'])
               for item in manifest['datasets'].values()
               if not seed.get('distributionDatasets') or item['dataset']['id'] in seed['distributionDatasets']]
    choices += [(item['id'], item['title']) for item in manifest.get('families', []) + seed.get('optionalDatasetLinks', [])]
    skin_ids = {key for key, item in manifest['datasets'].items() if item.get('capability') == 'skin-population-v2'}
    grouped = []
    for key, title in choices:
        item = ('skin', 'Skin') if key in skin_ids else (key, title)
        if item not in grouped:
            grouped.append(item)
    choices = grouped
    options = '<option value="empty" selected>Empty</option>' + ''.join(
        '<option value="' + escape(key, quote=True) + '">' + escape(title) + '</option>' for key, title in choices)
    for identifier in ('datasetSelect', 'panelDatasetSelect'):
        page = replace_element(page, identifier, f'<select id="{identifier}" data-entry="{escape(entry, quote=True)}">{options}</select>')
    for identifier in ('cohortSelect', 'panelCohortSelect', 'participantSelect', 'participantSortTarget', 'edgeSelect'):
        page = replace_element(page, identifier, f'<select id="{identifier}"><option>No data</option></select>')
    for identifier, value in {'sampleStress':'No embedding', 'sampleTitle':'3D sample view',
                               'datasetMessage':'Empty · no data loaded',
                               'sampleContext':'<h3>All displayed states</h3><p>No samples loaded.</p>',
                               'status':'0 feature vertices · 0 2-CST edges',
                               'catalogueStatus':'No states loaded.'}.items():
        tag = 'h2' if identifier == 'sampleTitle' else 'div'
        page = replace_element(page, identifier, f'<{tag} id="{identifier}">{value}</{tag}>')
    page = page.replace('id="valenciaColorControls" class="sampleHeaderColor" hidden', 'id="valenciaColorControls" class="sampleHeaderColor"')
    allowed = {'datasetSelect', 'panelDatasetSelect', 'toggleControls', 'sampleLegendPosition'}
    def disable(match):
        tag = match[0]
        identifier = re.search(r'\bid="([^"]+)"', tag)
        if identifier and (identifier[1] in allowed or identifier[1].startswith('maximize-')):
            return tag
        return tag if re.search(r'\bdisabled\b', tag) else tag[:-1] + ' disabled>'
    page = re.sub(r'<(?:input|select|button)\b[^>]*>', disable, page)
    # Data-bearing pages and legacy previews are not part of presentation mode.
    page = re.sub(r'<a\b[^>]*>(.*?)</a>', r'<span>\1</span>', page, flags=re.S)
    page = page.replace('</head>', '<style>.panelDivider{pointer-events:none;cursor:default} #sampleStress{font-size:12px;color:#58717c} #sampleContext{padding:8px} #featurePanel>#graphPanelHeader{flex-wrap:wrap;overflow-x:visible} #featurePanel>#graphPanelHeader h2{flex-basis:100%} </style></head>')
    return page + '<script>\n' + (HERE / 'empty_view.js').read_text() + '\n</script></body></html>\n'


def write_empty_view(manifest, destination, entry='index.html'):
    destination = Path(destination)
    content = render_empty_view(manifest, entry)
    with tempfile.NamedTemporaryFile('w', dir=destination.parent, delete=False) as handle:
        handle.write(content)
        temporary = handle.name
    os.replace(temporary, destination)
