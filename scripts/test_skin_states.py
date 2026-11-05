"""On-demand tests of external skin genus annotations and immutable base maps."""
import copy
import json
import os
from pathlib import Path
import tempfile
import unittest

import portable as p
import skin_states as states


@unittest.skipUnless(os.environ.get('COSMIX_SKIN_STATES'), 'Set COSMIX_SKIN_STATES to the reviewed sidecar')
class StatesTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.directory = Path(os.environ['COSMIX_SKIN_STATES'])
        cls.all = states.read(cls.directory)

    def test_all_populations_and_coverages(self):
        self.assertEqual(len(self.all), 7)
        self.assertEqual(sum(len(d['sampleIds'])*5 for d in self.all.values()), 21120)
        for data in self.all.values():
            states.validate(data)
            self.assertEqual(data['levels']['100']['assignments'], data['pure'])
            self.assertEqual(set(data['levels']['100']['methods']), {'core'})

    def test_membership_identity_counts_and_display_order_reject_corruption(self):
        original = self.all['skin1975-2010']
        def fails(change):
            data = copy.deepcopy(original);change(data)
            with self.assertRaises(ValueError):states.validate(data)
        fails(lambda d:d.update(baseRevision='wrong'))
        fails(lambda d:d['sampleIds'].__setitem__(0,d['sampleIds'][1]))
        fails(lambda d:d['levels']['60']['cores'].pop())
        fails(lambda d:d['levels']['60']['methods'].__setitem__(0,'unverified'))
        fails(lambda d:next(iter(d['states'].values()))['components'].reverse())
        fails(lambda d:next(iter(d['states'].values())).__setitem__('pureCount',0))
        population=dict(id=original['datasetId'],revision=original['baseRevision'],
                        records=[dict(specimenId=x) for x in reversed(original['sampleIds'])])
        with self.assertRaises(ValueError):states.validate(original,population)

    def test_attachment_is_idempotent_and_preserves_base_and_other_dataset(self):
        with tempfile.TemporaryDirectory() as temp:
            root=Path(temp);page=root/'index.html';manifest=dict(version=1,seed={},datasets={})
            for id in ('skin1975-2010','skin1975-1841'):
                d=self.all[id]
                population=dict(id=id,revision=d['baseRevision'],records=[dict(specimenId=x) for x in d['sampleIds']],
                                banks={'sentinel':{'coordinates':[[1,2,3]]}},pairs=[{'sentinel':True}])
                raw=p.encoded(dict(skinPopulation=population));h=p.sha(raw)
                desc=dict(url='/vme-assets/'+h+'.json',sha256=h,bytes=len(raw))
                path=p.asset_path(root,desc);path.parent.mkdir(parents=True,exist_ok=True);path.write_bytes(raw)
                manifest['datasets'][id]=dict(capability='skin-population-v2',parts=[desc])
            manifest['datasets']['other']={'sentinel':True}
            page.write_text('<script id="vme-http-manifest" type="application/json">'+json.dumps(manifest)+'</script>')
            digest=states.attach(page,self.directory);first=page.read_bytes()
            self.assertEqual(states.attach(page,self.directory),digest);self.assertEqual(page.read_bytes(),first)
            after=p.read_manifest(page);self.assertEqual(after['datasets']['other'],manifest['datasets']['other'])
            for id in ('skin1975-2010','skin1975-1841'):
                self.assertEqual(after['datasets'][id]['parts'][0],manifest['datasets'][id]['parts'][0])
                self.assertEqual(len(after['datasets'][id]['parts']),2)
                for desc in after['datasets'][id]['parts']:p.checked_bytes(root,desc)

    def test_unreviewed_manifest_rejected(self):
        with tempfile.TemporaryDirectory() as temp:
            directory=Path(temp);(directory/'manifest.json').write_bytes((self.directory/'manifest.json').read_bytes()+b' ')
            with self.assertRaisesRegex(ValueError,'unreviewed'):states.read(directory)


if __name__ == '__main__':unittest.main()
