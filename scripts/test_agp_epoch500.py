"""On-demand adoption and installer checks using separately supplied AGP assets."""
import json
import math
import os
from pathlib import Path
import shutil
import tempfile
import unittest

import agp_supplement as a
import portable as p


@unittest.skipUnless(os.environ.get('COSMIX_AGP_ERROR500') and os.environ.get('COSMIX_AGP_PREVIOUS'),
                     'Set COSMIX_AGP_ERROR500 and COSMIX_AGP_PREVIOUS to reviewed package directories')
class Epoch500Tests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.new = Path(os.environ['COSMIX_AGP_ERROR500'])
        cls.old = Path(os.environ['COSMIX_AGP_PREVIOUS'])

    def test_only_lower_relative_error_maps_replaced_and_aliases_preserved(self):
        receipt = json.loads((self.new/'release-selection.json').read_text())
        comparisons = receipt['comparisons']
        self.assertEqual(len(comparisons), 23)
        for row in comparisons:
            self.assertEqual(row['adopted'], row['epoch500Error'] < row['releasedError'])
        for kind, root, old_name, new_name, count in [
            ('ordinary', 'agpLocalBank', 'local-1cst-reviewed.json', 'local-1cst-error500.json', 9),
            ('unfolded', 'agpUnfolded', 'local-1cst-unfolded.json', 'local-1cst-unfolded-error500.json', 7),
        ]:
            old = json.loads((self.old/old_name).read_text())[root]
            new = json.loads((self.new/new_name).read_text())[root]
            chosen = {r['fitKey']: r for r in comparisons if r['kind'] == kind and r['adopted']}
            self.assertEqual(len(chosen), count)
            self.assertEqual(old['views'], new['views'])
            self.assertEqual(old['fits'].keys(), new['fits'].keys())
            for key, fit in old['fits'].items():
                updated = new['fits'][key]
                if key not in chosen:
                    self.assertEqual(updated, fit)
                    continue
                self.assertNotEqual(updated['coordinates'], fit['coordinates'])
                self.assertEqual(updated['metrics']['epochs'], 500)
                self.assertEqual(updated['metrics']['localError'], chosen[key]['epoch500Error'])
                self.assertFalse(updated['metrics']['epoch500Promotion']['neighborRecoveryUsedForSelection'])
                self.assertEqual(len(updated['coordinates']), len(fit['coordinates']))
                self.assertTrue(all(len(x) == 3 and all(math.isfinite(v) for v in x) for x in updated['coordinates']))
                self.assertEqual({k:v for k,v in updated.items() if k not in ('coordinates','metrics')},
                                 {k:v for k,v in fit.items() if k not in ('coordinates','metrics')})
            if kind == 'unfolded':
                self.assertEqual(new['baseSha'], p.sha((self.new/'local-1cst-error500.json').read_bytes()))
        for name in ('population.json', 'component-references.json', 'graph-layouts-3d.json'):
            self.assertEqual((self.new/name).read_bytes(), (self.old/name).read_bytes())

    def page(self, directory):
        page = directory/'index.html';(directory/'vme-assets').mkdir()
        manifest = dict(version=1, seed={}, datasets={'sentinel': dict(dataset=dict(id='sentinel', title='Other dataset'), parts=[])})
        page.write_text('<script id="vme-http-manifest" type="application/json">'+json.dumps(manifest)+
                        '</script><script src="/vme-assets/'+('0'*64)+'.js"></script>')
        return page

    def test_upgrade_repeat_and_fresh_install(self):
        with tempfile.TemporaryDirectory() as folder:
            root = Path(folder);page = self.page(root)
            a.attach(page, self.old/'population.json')
            before = p.read_manifest(page)
            a.attach(page, self.new/'population.json')
            after = p.read_manifest(page)
            self.assertEqual(before['datasets']['sentinel'], after['datasets']['sentinel'])
            self.assertEqual(before['datasets'][a.ID]['parts'][:3], after['datasets'][a.ID]['parts'][:3])
            self.assertEqual(after['datasets'][a.ID]['parts'][-2]['sha256'], a.LOCAL_ERROR500_PIN)
            self.assertEqual(after['datasets'][a.ID]['parts'][-1]['sha256'], a.UNFOLDED_ERROR500_PIN)
            a.attach(page, self.new/'population.json')
            self.assertEqual(after, p.read_manifest(page))
            fresh = root/'fresh';fresh.mkdir()
            fresh_page = self.page(fresh);a.attach(fresh_page, self.new/'population.json')
            self.assertEqual(p.read_manifest(fresh_page)['datasets'][a.ID], after['datasets'][a.ID])

    def test_corrupt_or_mismatched_bank_does_not_replace_page(self):
        with tempfile.TemporaryDirectory() as folder:
            root = Path(folder);page = self.page(root)
            a.attach(page, self.old/'population.json');original = page.read_bytes()
            supplied = root/'supplied';shutil.copytree(self.new, supplied)
            target = supplied/'local-1cst-error500.json';target.write_bytes(target.read_bytes()+b' ')
            with self.assertRaisesRegex(ValueError, 'reviewed fits'):
                a.attach(page, supplied/'population.json')
            self.assertEqual(page.read_bytes(), original)
            shutil.copy2(self.new/'local-1cst-error500.json', target)
            # A new unfolded bank must never be paired with the old ordinary bank.
            target.rename(supplied/'not-active.json')
            shutil.copy2(self.old/'local-1cst-reviewed.json', supplied/'local-1cst-reviewed.json')
            with self.assertRaisesRegex(ValueError, 'matching ordinary'):
                a.attach(page, supplied/'population.json')
            self.assertEqual(page.read_bytes(), original)


if __name__ == '__main__':
    unittest.main()
