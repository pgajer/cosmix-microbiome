"""On-demand skin v2 integrity, attachment and offline numeric-type tests."""
import copy
import json
import os
from pathlib import Path
import shutil
import tempfile
import unittest
from contextlib import nullcontext
from unittest.mock import patch

import portable as p
import skin_supplement as skin
from skin_exchange_v2 import Invalid, integer, number, unique


class ScalarTests(unittest.TestCase):
    def test_safe_counts_and_nonboolean_numbers(self):
        self.assertFalse(integer(True));self.assertFalse(number(False))
        self.assertFalse(integer(2**53));self.assertTrue(integer(2**53-1))
        self.assertFalse(number(float('inf')))
        with self.assertRaises(Invalid):unique([('a',1),('a',2)])


@unittest.skipUnless(os.environ.get('COSMIX_SKIN_BUNDLE'), 'Set COSMIX_SKIN_BUNDLE to a registered exchange directory')
class AttachmentTests(unittest.TestCase):
    def setUp(self):
        self.directory=Path(os.environ['COSMIX_SKIN_BUNDLE'])
        self.temp=tempfile.TemporaryDirectory();self.addCleanup(self.temp.cleanup)
        self.root=Path(self.temp.name);self.page=self.root/'index.html'
        self.old=dict(version=1,seed=dict(distributionDatasets=['unrelated']),datasets={'unrelated':dict(dataset={'id':'unrelated'})})
        self.page.write_text('<script id="vme-http-manifest" type="application/json">'+json.dumps(self.old)+'</script><script src="/vme-assets/'+'a'*64+'.js"></script>')

    def test_pin_and_metadata_identity(self):
        with self.assertRaisesRegex(ValueError,'registered'):skin.population(self.directory,{})
        data=skin.population(self.directory)
        self.assertNotIn('counts',data)
        self.assertEqual({r['specimenId'] for r in data['records']},{r['specimenId'] for r in data['eligibility']})
        self.assertEqual(len(data['banks']),3)

    def test_idempotent_and_unrelated_dataset_unchanged(self):
        first=skin.attach(self.page,[self.directory]);before=self.page.read_bytes()
        self.assertEqual(skin.attach(self.page,[self.directory]),first)
        self.assertEqual(self.page.read_bytes(),before)

        m=p.read_manifest(self.page)
        self.assertEqual(m['datasets']['unrelated'],self.old['datasets']['unrelated'])
        self.assertEqual(m['seed']['distributionDatasets'].count(self.directory.name),1)
        self.assertIn('skinViewer',m)
        for d in p.descriptors(m):p.checked_bytes(self.root,d)

    @unittest.skipUnless(os.environ.get('COSMIX_SKIN_CATALOG'), 'Set COSMIX_SKIN_CATALOG for installer checks')
    def test_update_remembers_supplement_and_failed_candidate_preserves_app(self):
        app=self.root/'app'
        with patch.object(p,'stopped_viewer',return_value=nullcontext()):
            p.update(output=app,catalog=Path(os.environ['COSMIX_SKIN_CATALOG']),
                     datasets=[self.directory.name],skin_exchanges=[self.directory])
            before=(app/'web/index.html').read_bytes()
            p.update(output=app)
            self.assertEqual((app/'web/index.html').read_bytes(),before)
            self.assertEqual(json.loads((app/'SOURCE_AND_DATA.json').read_text())['skinExchanges'],[str(self.directory.resolve())])
            with patch.object(p,'validate_prepared',side_effect=ValueError('simulated post-attachment failure')):
                with self.assertRaisesRegex(ValueError,'post-attachment'):p.update(output=app)
            self.assertEqual((app/'web/index.html').read_bytes(),before)

    def test_failure_preserves_page_and_conflicts_fail(self):
        before=self.page.read_bytes()
        bad=self.root/'bad';shutil.copytree(self.directory,bad)
        (bad/'records.json').write_bytes((bad/'records.json').read_bytes()+b' ')
        with self.assertRaises(ValueError):skin.attach(self.page,[bad])
        self.assertEqual(self.page.read_bytes(),before)
        skin.attach(self.page,[self.directory]);m=p.read_manifest(self.page)
        m['datasets'][self.directory.name]['dataset']['revision']='conflicting'
        self.page.write_text('<script id="vme-http-manifest" type="application/json">'+json.dumps(m)+'</script><script src="/vme-assets/'+'a'*64+'.js"></script>')
        before=self.page.read_bytes()
        with self.assertRaisesRegex(ValueError,'Conflicting'):skin.attach(self.page,[self.directory])
        self.assertEqual(self.page.read_bytes(),before)


if __name__=='__main__':unittest.main()
