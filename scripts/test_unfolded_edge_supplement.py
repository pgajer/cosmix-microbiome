"""Small self-contained context/default/coordinate rejection tests."""
import base64
import copy
import math
import struct
import unittest
from unfolded_edge_supplement import validate, selections, digest, key, POLICY, TARGET


def fixture():
    records=[dict(id='a',profile=0),dict(id='b',profile=1),dict(id='c',profile=1)]
    bundle=dict(dataset=dict(id='zapps-pressmat-v4',revision='b'),data=dict(graphs={'90':dict(edges=[dict(id='1,2')])},localEmbeddings={'1,2':dict(indices=[0,1])}),cohortAnalysis=dict(records=records,populations={'all':{}},specs={}))
    participants=dict(records=records,analysisRevision='p',features=['a','b'],compositions={'0':[[0,.8],[1,.2]],'1':[[0,.2],[1,.8]]})
    context=key(['all','pure','90','group','1,2'])
    selection=dict(endpoints=[1,2],profiles=[0,1],membershipSha256=digest([0,1]),observations=3,recordIdsSha256=digest(['a','b','c']),endpointTotals=[1.2,1.8],totalObservations=3,totalRecordIdsSha256=digest(['a','b','c']),defaultAnchorFeatureId=2,defaultAnchorPolicy=POLICY)
    totals=[math.fsum(dict(participants['compositions'][str(r['profile'])]).get(j,0) for r in records) for j in range(2)]
    selection['abundanceBasis']=dict(population='all-eligible-dataset-records',normalization='full-composition-sum-to-one',recordOrder='participants.records source order',recordMapSha256=digest([[r['id'],r['profile']] for r in records]),compositionsSha256=digest(participants['compositions']),totalsSha256=digest(totals))
    bank=dict(version=1,dataset='zapps-pressmat-v4',baseRevision='b',analysisRevision='p',inputs={'fixture':'a'*64},featureOrderSha256=digest(participants['features']),settings={'targets':TARGET},scope=dict(kind='edge',cohorts=['all'],modes=['pure'],coverages=['90'],anchors='both-endpoints',complete=True),contexts={},selections={context:selection},contextReceipts={},fits={},provenance=dict(run='r',runtime='t'))
    for anchor in [0,1]:
        fit=dict(edge='1,2',anchor=anchor,profiles=[0,1],metric='euclidean',coordinateEncoding='float64-le-base64',coordinates=base64.b64encode(struct.pack('<6d',0,0,0,1.5,0,0)).decode(),solver={'backend':'analytic'},evaluation=dict(profiles=2,relativeRms=0,pairs=1),validation=dict(seeds=[]),provenance=dict(run='r',runtime='t'))
        fit['receipt']=digest(fit);fk=digest(dict(edge='1,2',anchor=anchor,profiles=[0,1]))+':euclidean'
        bank['fits'][fk]=fit;bank['contexts'][key(json_parts(context)+[str(anchor+1)])]=fk
    seal(bank)
    return bank,bundle,participants


def json_parts(s):
    import json
    return json.loads(s)


def seal(bank):
    for ctx,fk in bank['contexts'].items():
        fit=bank['fits'][fk];fit['receipt']=digest({k:v for k,v in fit.items() if k!='receipt'})
        r={n:bank[n] for n in ['dataset','baseRevision','analysisRevision','inputs','featureOrderSha256','settings']}
        parts=json_parts(ctx);r.update(context=parts,selection=bank['selections'][key(parts[:5])],fitKey=fk,fitReceipt=fit['receipt']);bank['contextReceipts'][ctx]=digest(r)
    bank['revision']=digest({k:v for k,v in bank.items() if k!='revision'})


class EdgeBankTests(unittest.TestCase):
    def setUp(self):self.bank,self.bundle,self.participants=fixture()
    def test_complete_self_contained(self):validate(self.bank,self.bundle,self.participants)
    def test_partial_requires_offline_permission(self):
        self.bank['scope']['complete']=False;seal(self.bank)
        with self.assertRaisesRegex(ValueError,'partial'):validate(self.bank,self.bundle,self.participants)
        validate(self.bank,self.bundle,self.participants,allow_partial=True)
    def test_both_endpoints_required(self):
        self.bank['contexts'].pop(next(iter(self.bank['contexts'])));seal(self.bank)
        with self.assertRaisesRegex(ValueError,'endpoint'):validate(self.bank,self.bundle,self.participants)
    def test_complete_scope_cannot_hide_supported_coverage(self):
        self.bundle['data']['graphs']['80']=copy.deepcopy(self.bundle['data']['graphs']['90'])
        with self.assertRaisesRegex(ValueError,'omits supported'):validate(self.bank,self.bundle,self.participants)
    def test_resealed_wrong_anchor(self):
        next(iter(self.bank['fits'].values()))['anchor']=2;seal(self.bank)
        with self.assertRaisesRegex(ValueError,'anchor'):validate(self.bank,self.bundle,self.participants)
    def test_membership_not_vertex_union(self):
        next(iter(self.bank['selections'].values()))['profiles']=[0];seal(self.bank)
        with self.assertRaisesRegex(ValueError,'membership'):validate(self.bank,self.bundle,self.participants)
    def test_default_uses_record_multiplicity(self):
        next(iter(self.bank['selections'].values()))['defaultAnchorFeatureId']=1;seal(self.bank)
        with self.assertRaisesRegex(ValueError,'default anchor'):validate(self.bank,self.bundle,self.participants)
    def test_wrong_population_totals(self):
        next(iter(self.bank['selections'].values()))['endpointTotals']=[1,1];seal(self.bank)
        with self.assertRaisesRegex(ValueError,'totals'):validate(self.bank,self.bundle,self.participants)
    def test_stale_release(self):
        self.bank['baseRevision']='old';seal(self.bank)
        with self.assertRaisesRegex(ValueError,'release'):validate(self.bank,self.bundle,self.participants)
    def test_nonfinite(self):
        next(iter(self.bank['fits'].values()))['coordinates']=base64.b64encode(struct.pack('<6d',float('nan'),0,0,1,0,0)).decode();seal(self.bank)
        with self.assertRaisesRegex(ValueError,'nonfinite'):validate(self.bank,self.bundle,self.participants)
    def test_unused_fit(self):
        self.bank['fits']['orphan']=copy.deepcopy(next(iter(self.bank['fits'].values())));seal(self.bank)
        with self.assertRaisesRegex(ValueError,'unused'):validate(self.bank,self.bundle,self.participants)
    def test_analysis_order_is_not_receipt_order(self):
        self.bundle['cohortAnalysis']['records']=list(reversed(self.bundle['cohortAnalysis']['records']))
        validate(self.bank,self.bundle,self.participants)
    def test_abundance_basis_required(self):
        next(iter(self.bank['selections'].values()))['abundanceBasis']['normalization']='pair-only';seal(self.bank)
        with self.assertRaisesRegex(ValueError,'basis'):validate(self.bank,self.bundle,self.participants)
    def test_compositions_must_sum_to_one(self):
        self.participants['compositions']['0'][0][1]=.4
        with self.assertRaisesRegex(ValueError,'relative abundances'):validate(self.bank,self.bundle,self.participants)
    def test_feature_order(self):
        self.participants['features'].reverse()
        with self.assertRaisesRegex(ValueError,'feature order'):validate(self.bank,self.bundle,self.participants)
    def test_reviewed_dataset_readers(self):
        for dataset in ['lsvf-v3v4-20241111','umb-hmp-2019-panel','hmp-u01-2019','sante-16s','papclear-v3v4-provisional-20261017']:
            self.bank['dataset']=self.bundle['dataset']['id']=dataset;seal(self.bank)
            validate(self.bank,self.bundle,self.participants)
    def test_unknown_dataset_stays_rejected(self):
        self.bundle['dataset']['id']='unreviewed'
        with self.assertRaisesRegex(ValueError,'not reviewed'):selections(self.bundle)
    def assay_source(self):
        self.bundle['dataset']['id']='lsvf-v3v4-20241111'
        a=self.bundle['cohortAnalysis']
        for r in a['records']:r['cohort']='LSVF'
        a['populations']['assay']={'recordIndices':[1],'sourceCohorts':['LSVF']}
        self.bundle['data']['samples']={'pair':['1,2','1,2']}
        a['specs']['assay|pure|90']={'cohort':'assay','mode':'pure','q':'90','population':[1],'states':{'1,2':'fit'}}
        a['fits']={'fit':{'indices':[1],'profileIndices':[1]}}
        return a
    def test_assay_records_override_source_cohort_and_duplicate_profiles(self):
        self.assay_source()
        self.assertEqual(selections(self.bundle)[key(['assay','pure','90','group','1,2'])],[1])
    def test_spec_cannot_expand_assay_to_same_profile_record(self):
        a=self.assay_source();a['specs']['assay|pure|90']['population']=[1,2]
        a['fits']['fit']['indices']=[1,2]
        with self.assertRaisesRegex(ValueError,'source population differs'):selections(self.bundle)
    def test_invalid_assay_record_indices(self):
        a=self.assay_source()
        for ii in [[1,1],[-1],[3],[True]]:
            a['populations']['assay']['recordIndices']=ii
            with self.assertRaisesRegex(ValueError,'invalid source record indices'):selections(self.bundle)
    def test_full_population_cannot_be_narrowed(self):
        self.bundle['cohortAnalysis']['populations']['all']={'recordIndices':[0,1]}
        with self.assertRaisesRegex(ValueError,'full source population'):selections(self.bundle)

if __name__=='__main__':unittest.main()
