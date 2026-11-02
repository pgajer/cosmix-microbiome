"""Selectable releases: subset isolation, integrity and update failure safety."""
import copy
import json
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch
from contextlib import nullcontext
import portable as p
import meeting_release as r


def fixture(root):
    def file(relative, data):
        path=root/relative;path.parent.mkdir(parents=True,exist_ok=True);path.write_bytes(data)
        return dict(path=relative,bytes=len(data),sha256=p.sha(data))
    def asset(web, raw, suffix='json'):
        digest=p.sha(raw);url='/vme-assets/'+digest+'.'+suffix
        file(web+url,raw)
        return dict(url=url,bytes=len(raw),sha256=digest)
    plotly=asset('common',b'// Plotly placeholder','js')
    common=file('common/manifest.json',p.encoded(dict(seed={},plotly=plotly)))
    server=file('common/vme-server',b'#!/bin/sh\nexit 0\n')
    catalog=dict(format=r.FORMAT,version=1,release='test-v1',common=common,server=server,datasets={})
    for identifier in ('a','b'):
        data=asset('datasets/'+identifier,p.encoded(dict(bundles=[dict(dataset=dict(id=identifier))])))
        lazy=asset('datasets/'+identifier,p.encoded(dict(fits={identifier:[1,2,3]})))
        entry=dict(dataset=dict(id=identifier,title=identifier,revision='v1'),parts=[data],deferred=dict(subjectEmbeddings=dict(parts=[lazy])))
        part=dict(release='test-v1',id=identifier,dataset=entry,seed=dict(legendAbundanceTotals={identifier:{'total':1}}))
        desc=file('datasets/'+identifier+'/manifest.json',p.encoded(part))
        catalog['datasets'][identifier]=dict(title=identifier,manifest=desc,archive=identifier+'.zip')
    file('catalog.json',p.encoded(catalog))
    return catalog


class ReleaseTests(unittest.TestCase):
    def test_single_dataset_has_no_other_assets_or_metadata(self):
        with tempfile.TemporaryDirectory() as temp:
            root=Path(temp);fixture(root)
            _,manifest,sources=r.compose(root,['b'])
            self.assertEqual(list(manifest['datasets']),['b'])
            self.assertEqual(manifest['seed']['default'],'b')
            self.assertEqual(list(manifest['seed']['legendAbundanceTotals']),['b'])
            self.assertFalse(manifest['families'])
            self.assertTrue(all('/a' not in str(web) for web,_ in sources.values()))
            self.assertEqual(len(sources),3) # Plotly, eager asset, deferred asset.

    def test_picker_missing_unknown_and_empty(self):
        with tempfile.TemporaryDirectory() as temp:
            root=Path(temp);fixture(root)
            with patch('builtins.input',return_value='2'):
                self.assertEqual(r.selection(root,interactive=True),['b'])
            self.assertEqual(r.selection(root,previous=['a']),['a'])
            for ids in ([],['unknown']):
                with self.assertRaises(ValueError):r.selection(root,ids)
            (root/'datasets/b/manifest.json').unlink()
            with self.assertRaisesRegex(ValueError,'b.zip'):r.selection(root,['b'])
            with patch('builtins.input',return_value='0'):
                with self.assertRaises(ValueError):r.selection(root,interactive=True)

    def test_integrity_failure_before_candidate_creation(self):
        with tempfile.TemporaryDirectory() as temp:
            root=Path(temp)/'release';root.mkdir();fixture(root)
            _,_,sources=r.compose(root,['b'])
            web,d=next((w,d) for w,d in sources.values() if '/datasets/b' in str(w))
            p.asset_path(web,d).write_bytes(b'corrupt')
            output=Path(temp)/'app'
            with self.assertRaisesRegex(ValueError,'checksum'):r.assemble(root,['b'],output)
            self.assertFalse(output.exists())

    def test_manifest_binding_and_path_containment(self):
        with tempfile.TemporaryDirectory() as temp:
            root=Path(temp);catalog=fixture(root)
            for value in ('../escape','/absolute'):
                with self.assertRaises(ValueError):r.contained(root,value)
            part=root/'datasets/a/manifest.json';data=json.loads(part.read_text());data['release']='other';part.write_bytes(p.encoded(data))
            # Re-seal the file in the catalogue: release identity must still fail.
            catalog['datasets']['a']['manifest']['bytes']=part.stat().st_size
            catalog['datasets']['a']['manifest']['sha256']=p.sha(part.read_bytes())
            (root/'catalog.json').write_bytes(p.encoded(catalog))
            with self.assertRaisesRegex(ValueError,'different release'):r.compose(root,['a'])

    def test_update_remembers_subset_and_preserves_previous_on_failure(self):
        with tempfile.TemporaryDirectory() as temp:
            root=Path(temp);data=root/'data';data.mkdir();fixture(data);app=root/'app'
            with patch.object(p,'update_lock',return_value=nullcontext()), patch.object(p,'stopped_viewer',return_value=nullcontext()):
                p.update(output=app,catalog=data,datasets=['b'])
                receipt=json.loads((app/'SOURCE_AND_DATA.json').read_text())
                self.assertEqual(receipt['datasets'],['b'])
                p.update(output=app) # Same paths and selection, no prompt.
                self.assertEqual(json.loads((app/'SOURCE_AND_DATA.json').read_text())['datasets'],['b'])
                before=(app/'web/index.html').read_bytes()
                with patch.object(r,'assemble',side_effect=ValueError('failed candidate')):
                    with self.assertRaisesRegex(ValueError,'failed candidate'):
                        p.update(output=app,datasets=['a'])
                self.assertEqual((app/'web/index.html').read_bytes(),before)
                p.update(output=app,datasets=['a'])
                self.assertEqual(json.loads((app/'SOURCE_AND_DATA.json').read_text())['datasets'],['a'])
                self.assertTrue((data/'datasets/b/manifest.json').exists())
                self.assertTrue(list(root.glob('app-update-*/previous')))

    def test_changed_catalogue_requires_explicit_new_release(self):
        with tempfile.TemporaryDirectory() as temp:
            root=Path(temp);data=root/'data';data.mkdir();fixture(data);app=root/'app'
            with patch.object(p,'update_lock',return_value=nullcontext()), patch.object(p,'stopped_viewer',return_value=nullcontext()):
                p.update(output=app,catalog=data,datasets=['a'])
                with (data/'catalog.json').open('a') as stream:stream.write('\n')
                with self.assertRaisesRegex(ValueError,'catalogue changed'):p.update(output=app)
                p.update(output=app,catalog=data,datasets=['a'])


if __name__=='__main__':unittest.main()
