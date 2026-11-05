"""On-demand supplement integrity, upgrade and unchanged-embedding checks."""
import json
import os
from pathlib import Path
import shutil
import tempfile
import unittest
import agp_supplement as a
import agp_connections_supplement as c
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
                if file.name!='pure-1cst-connections.json':shutil.copy2(file,old/file.name)
            a.attach(page,old/'population.json');before=p.read_manifest(page)
            a.attach(page,source/'population.json');after=p.read_manifest(page)
            self.assertEqual(after['datasets'][a.ID]['parts'][:-1],before['datasets'][a.ID]['parts'])
            self.assertEqual(after['datasets'][a.ID]['parts'][-1]['sha256'],c.PIN)
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
