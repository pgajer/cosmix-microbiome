"""On-demand outcome export integrity and installation tests; no model fitting."""
import copy
import json
import os
from pathlib import Path
import tempfile
import unittest
import agp_outcomes_supplement as o
import agp_supplement as a
import portable as p


@unittest.skipUnless(os.environ.get('COSMIX_AGP_OUTCOMES'), 'Set COSMIX_AGP_OUTCOMES to the supplied outcome data directory')
class OutcomesTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.folder = Path(os.environ['COSMIX_AGP_OUTCOMES'])
        cls.population = json.loads((cls.folder/'population.json').read_bytes())
        cls.bank = json.loads(o.checked_outcomes(cls.folder/'outcome-estimates.json', cls.population))['agpOutcomeEstimates']

    def test_id_alignment_not_position(self):
        shuffled = copy.deepcopy(self.population)
        shuffled['ids'].reverse()
        shuffled['schemes']['70%-1-CST']['merged'].reverse()
        o.validate(self.bank, shuffled)
        shuffled['schemes']['70%-1-CST']['merged'][0] = 'wrong'
        with self.assertRaisesRegex(ValueError, 'memberships'): o.validate(self.bank, shuffled)

    def test_masks_and_probabilities(self):
        bank = copy.deepcopy(self.bank)
        key = next(k for k in bank['series'] if k.startswith('index__'))
        nonindex = next(i for i in range(len(bank['sample'])) if i not in set(bank['index']))
        self.assertIsNone(bank['series'][key][nonindex])
        bank['series'][key][nonindex] = 0
        with self.assertRaisesRegex(ValueError, 'unavailable'): o.validate(bank, self.population)
        bank['series'][key][nonindex] = None
        bank['outcomes']['ibs'][0] = 'NA'
        with self.assertRaisesRegex(ValueError, 'answer'): o.validate(bank, self.population)

    def test_fresh_upgrade_and_repeat(self):
        with tempfile.TemporaryDirectory() as folder:
            root = Path(folder); (root/'vme-assets').mkdir()
            empty = '<script id="vme-http-manifest" type="application/json">'+json.dumps(dict(version=1,seed={},datasets={}))+'</script><script src="/vme-assets/'+('0'*64)+'.js"></script>'
            page = root/'index.html';page.write_text(empty)
            previous = self.folder.parent/'graph-layouts-v3'/'population.json'
            a.attach(page, previous)
            before = p.read_manifest(page)
            a.attach(page, self.folder/'population.json')
            after = p.read_manifest(page)
            self.assertEqual(before['datasets'][a.ID]['parts'], after['datasets'][a.ID]['parts'][:-1])
            self.assertEqual(after['datasets'][a.ID]['parts'][-1]['sha256'], o.PIN)
            for descriptor in p.descriptors(after): p.checked_bytes(root, descriptor)
            a.attach(page, self.folder/'population.json');self.assertEqual(after, p.read_manifest(page))
            fresh=root/'fresh.html';fresh.write_text(empty);a.attach(fresh,self.folder/'population.json')
            self.assertEqual(after,p.read_manifest(fresh))
            with self.assertRaisesRegex(ValueError, 'Conflicting'): a.attach(page, previous)
            self.assertEqual(after,p.read_manifest(page))
            corrupt=root/'corrupt.json';corrupt.write_bytes((self.folder/'outcome-estimates.json').read_bytes()+b' ')
            with self.assertRaisesRegex(ValueError, 'reviewed'): o.checked_outcomes(corrupt,self.population)


if __name__ == '__main__': unittest.main()
