"""On-demand fresh/upgrade/remembered graph layout supplement validation."""
import json
import os
from pathlib import Path
import shutil
import tempfile
import unittest
import portable as p
import agp_supplement as a
import agp_connection_layouts_supplement as c

@unittest.skipUnless(os.environ.get('COSMIX_AGP_LAYOUTS'),'Set COSMIX_AGP_LAYOUTS to the reviewed AGP data folder')
class LayoutTests(unittest.TestCase):
    def test_install_upgrade_repeat_and_corruption(self):
        source=Path(os.environ['COSMIX_AGP_LAYOUTS'])
        with tempfile.TemporaryDirectory() as folder:
            root=Path(folder);web=root/'web';web.mkdir();(web/'vme-assets').mkdir()
            empty='<script id="vme-http-manifest" type="application/json">'+json.dumps(dict(version=1,seed={},datasets={}))+'</script><script src="/vme-assets/'+('0'*64)+'.js"></script>'
            page=web/'index.html';page.write_text(empty)
            old=root/'old';shutil.copytree(source,old);(old/'connection-layouts-3d.json').unlink()
            a.attach(page,old/'population.json');before=p.read_manifest(page)
            a.attach(page,source/'population.json');after=p.read_manifest(page)
            self.assertEqual(before['datasets'][a.ID]['parts'],after['datasets'][a.ID]['parts'][:-1])
            self.assertEqual(after['datasets'][a.ID]['parts'][-1]['sha256'],c.PIN)
            a.attach(page,source/'population.json');self.assertEqual(p.read_manifest(page),after)
            for d in p.descriptors(after):p.checked_bytes(web,d)
            fresh=web/'fresh.html';fresh.write_text(empty);a.attach(fresh,source/'population.json')
            self.assertEqual(p.read_manifest(fresh),after)
            preserved=page.read_bytes()
            with self.assertRaisesRegex(ValueError,'Conflicting'):a.attach(page,old/'population.json')
            self.assertEqual(page.read_bytes(),preserved)
            shutil.copy2(source/'connection-layouts-3d.json',old/'connection-layouts-3d.json')
            with (old/'connection-layouts-3d.json').open('ab') as f:f.write(b' ')
            with self.assertRaisesRegex(ValueError,'reviewed graph fits'):a.attach(page,old/'population.json')
            self.assertEqual(page.read_bytes(),preserved)

if __name__=='__main__':unittest.main()
