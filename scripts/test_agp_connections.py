"""On-demand supplement integrity, upgrade and unchanged-embedding checks."""
import json
import os
from pathlib import Path
import shutil
import tempfile
import unittest
import agp_supplement as a
import agp_connections_supplement as c
import agp_connection_layouts_supplement as layouts
import portable as p


@unittest.skipUnless(os.environ.get('COSMIX_AGP_CONNECTIONS'),'Set COSMIX_AGP_CONNECTIONS to the reviewed package directory')
class ConnectionsTests(unittest.TestCase):
    def test_fresh_upgrade_repeat_and_corruption(self):
        source=Path(os.environ['COSMIX_AGP_CONNECTIONS'])
        with tempfile.TemporaryDirectory() as folder:
            root=Path(folder);(root/'vme-assets').mkdir();page=root/'index.html'
            page.write_text('<script id="vme-http-manifest" type="application/json">'+json.dumps(dict(version=1,seed={},datasets={}))+
                '</script><script src="/vme-assets/'+('0'*64)+'.js"></script>')
            old=root/'old';old.mkdir()
            for file in source.glob('*.json'):
                if file.name not in ['pure-1cst-connections.json','merged-1cst-connections.json','connection-layouts-3d.json']:shutil.copy2(file,old/file.name)
            a.attach(page,old/'population.json');before=p.read_manifest(page)
            a.attach(page,source/'population.json');after=p.read_manifest(page)
            extra=[c.PIN]+([c.MERGED_PIN] if (source/'merged-1cst-connections.json').exists() else [])
            if (source/'connection-layouts-3d.json').exists():extra.append(layouts.PIN)
            self.assertEqual(after['datasets'][a.ID]['parts'][:-len(extra)],before['datasets'][a.ID]['parts'])
            self.assertEqual([part['sha256'] for part in after['datasets'][a.ID]['parts'][-len(extra):]],extra)
            if (source/'merged-1cst-connections.json').exists():
                # Upgrade an existing pure-core package, without changing any earlier part.
                intermediate=root/'intermediate';shutil.copytree(source,intermediate)
                (intermediate/'merged-1cst-connections.json').unlink()
                (intermediate/'connection-layouts-3d.json').unlink(missing_ok=True)
                stage=root/'stage.html';stage.write_text('<script id="vme-http-manifest" type="application/json">'+json.dumps(before)+
                    '</script><script src="/vme-assets/'+('0'*64)+'.js"></script>')
                a.attach(stage,intermediate/'population.json');middle=p.read_manifest(stage)
                a.attach(stage,source/'population.json')
                self.assertEqual(p.read_manifest(stage),after)
                self.assertEqual(middle['datasets'][a.ID]['parts'],after['datasets'][a.ID]['parts'][:-(len(extra)-1)])
                f=intermediate/'merged-1cst-connections.json';f.write_bytes((source/f.name).read_bytes()+b' ')
                with self.assertRaisesRegex(ValueError,'reviewed coverage'):a.attach(page,intermediate/'population.json')

            a.attach(page,source/'population.json');self.assertEqual(after,p.read_manifest(page))
            # Missing or altered scientific supplements cannot silently replace a release.
            frozen=page.read_bytes()
            with self.assertRaisesRegex(ValueError,'Conflicting'):a.attach(page,old/'population.json')
            self.assertEqual(page.read_bytes(),frozen)
            bad=root/'bad';shutil.copytree(source,bad)
            f=bad/'pure-1cst-connections.json';f.write_bytes(f.read_bytes()+b' ')
            with self.assertRaisesRegex(ValueError,'reviewed pure-state'):a.attach(page,bad/'population.json')
            self.assertEqual(page.read_bytes(),frozen)
            population=json.loads((source/'population.json').read_text());population['ids'].reverse()
            with self.assertRaisesRegex(ValueError,'identities'):c.checked_connections(source/'pure-1cst-connections.json',population)
            fresh=root/'fresh';fresh.mkdir();(fresh/'vme-assets').mkdir();freshpage=fresh/'index.html'
            freshpage.write_text('<script id="vme-http-manifest" type="application/json">'+json.dumps(dict(version=1,seed={},datasets={}))+
                '</script><script src="/vme-assets/'+('0'*64)+'.js"></script>')
            a.attach(freshpage,source/'population.json');self.assertEqual(p.read_manifest(freshpage),after)


if __name__=='__main__':unittest.main()
