"""Validate the reviewed skin v2 exchange before adapting it for CoSMiX.

Sparse counts stay offline; native installation and UI acceptance are separate.
"""
import json,hashlib,math,itertools,re
from pathlib import Path
METHODS=['l1-euclidean','max-euclidean','max-linf'];SAFE=2**53-1
PAYLOADS={'records.json','eligibility.json','counts.json','pairs.json','provenance.json'}|{m+'.json' for m in METHODS}
class Invalid(ValueError):pass
def need(ok,message='invalid exchange'):
 if not ok:raise Invalid(message)
def obj(x,keys):need(type(x) is dict and set(x)==set(keys.split()),'object fields')
def ident(x):need(type(x) is str and bool(x.strip()) and '\x00' not in x,'nonempty string')
def number(x):return type(x) in (int,float) and math.isfinite(x)
def integer(x,lo=0,hi=SAFE):return type(x) is int and lo<=x<=hi
def stringlist(x):
 need(type(x) is list);[ident(v) for v in x];need(len(x)==len(set(x)))
def unique(items):
 d={}
 for k,v in items:need(k not in d,'duplicate JSON key');d[k]=v
 return d
def load(p):
 try:return json.loads(p.read_text(encoding='utf-8'),object_pairs_hook=unique,parse_constant=lambda x:(_ for _ in ()).throw(Invalid('nonfinite JSON')))
 except (UnicodeError,json.JSONDecodeError) as e:raise Invalid(str(e)) from e
def manifest(m):
 obj(m,'format schemaVersion datasetId revision studyId title synthetic capability contexts methods countEncoding pairPolicy exploratory files')
 need(m['format']=='cosmix-skin-exchange' and m['schemaVersion']=='2' and m['capability']=='skin-population-v2')
 for k in ['datasetId','revision','studyId','title']:ident(m[k])
 need(type(m['synthetic']) is bool);need(m['contexts']==['population'] and m['methods']==METHODS and m['countEncoding']=='specimen-sparse-v1')
 need(m['pairPolicy'] in ['complete-consecutive-trajectory-subset','reviewed-subset-of-consecutive'])
 if m['synthetic']:need(m['datasetId'].startswith('fixture-') and m['title'].startswith('SYNTHETIC · '))
 else:need(not m['datasetId'].startswith('fixture-'))
 e=m['exploratory'];obj(e,'badge notice surfaces');ident(e['badge']);ident(e['notice']);need(e['surfaces']==['dataset-selection','population-view','image-export','specimen-export','edge-export'])
 need(e['badge'] in ['Exploratory · metadata and batch issues unresolved','Exploratory · batch QC unresolved'])
 if m['studyId']=='10894':need(e['badge']=='Exploratory · batch QC unresolved')
 need(type(m['files']) is list);names=[]
 for f in m['files']:
  obj(f,'name bytes sha256');ident(f['name']);need(f['name'] in PAYLOADS and Path(f['name']).name==f['name']);need(integer(f['bytes']));need(type(f['sha256']) is str and re.fullmatch('[0-9a-f]{64}',f['sha256']) is not None);names.append(f['name'])
 need(len(names)==len(set(names)) and set(names)==PAYLOADS,'inventory')
def validate(x,m):
 manifest(m);need(set(x)==PAYLOADS)
 ledger=x['eligibility.json'];need(type(ledger) is list);el={}
 for e in ledger:
  obj(e,'specimenId role embeddingEligible participantLinkEligible trajectoryEligible reasons');ident(e['specimenId']);need(e['specimenId'] not in el);el[e['specimenId']]=e
  need(e['role'] in ['skin-swab','laboratory-control','unresolved']);obj(e['reasons'],'embedding participant trajectory')
  for v in e['reasons'].values():ident(v)
  for k in ['embeddingEligible','participantLinkEligible','trajectoryEligible']:need(type(e[k]) is bool)
  need(not e['embeddingEligible'] or e['role']=='skin-swab');need(not e['participantLinkEligible'] or e['embeddingEligible']);need(not e['trajectoryEligible'] or e['participantLinkEligible'])
 ids={s for s,e in el.items() if e['embeddingEligible']};need(bool(ids))
 records=x['records.json'];need(type(records) is list);rr={};groups={}
 for r in records:
  obj(r,'specimenId participantId site visitOrder visitLabel sourceParticipantId sourceVisit sourceSite familyId ageYears sex validity source sourceRunLabel sourcePlateLabel batchQcStatus time')
  ident(r['specimenId']);s=r['specimenId'];need(s in ids and s not in rr);rr[s]=r;e=el[s]
  for k in ['sourceParticipantId','sourceVisit','sourceSite','familyId','sourceRunLabel','sourcePlateLabel']:
   if r[k] is not None:ident(r[k])
  ident(r['visitLabel']);need(r['batchQcStatus']=='unresolved');v=r['validity'];obj(v,'participant site visit age sex');need(all(a in ['verified','unverified','unknown'] for a in v.values()))
  if e['participantLinkEligible']:ident(r['participantId']);need(v['participant']=='verified')
  else:need(r['participantId'] is None and v['participant']!='verified')
  if v['site']=='verified':ident(r['site'])
  else:need(r['site'] is None)
  if v['visit']=='verified':need(number(r['visitOrder']))
  else:need(r['visitOrder'] is None)
  if v['age']=='verified':need(number(r['ageYears']) and 0<=r['ageYears']<=130)
  else:need(r['ageYears'] is None)
  if v['sex']=='verified':ident(r['sex'])
  else:need(r['sex'] is None)
  so=r['source'];obj(so,'repository studyId sampleId runIds');ident(so['repository']);ident(so['studyId']);need(so['studyId']==m['studyId'] and so['sampleId']==s);stringlist(so['runIds']);need(so['repository']==('synthetic' if m['synthetic'] else 'Qiita'))
  t=r['time'];obj(t,'basis value unit originId')
  if t['basis']=='ordinal':need(t['value'] is None and t['unit'] is None and t['originId'] is None)
  else:need(t['basis']=='measured-relative' and integer(t['value'],-SAFE) and t['unit']=='days');ident(t['originId']);need(e['participantLinkEligible'])
  if e['trajectoryEligible']:
   need(v['site']==v['visit']=='verified');groups.setdefault((r['participantId'],r['site']),[]).append(r)
  if m['studyId']=='10894':need(t['basis']=='ordinal')
 need(set(rr)==ids)
 c=x['counts.json'];obj(c,'encoding features counts');need(c['encoding']=='specimen-sparse-v1' and type(c['features']) is list and len(c['features'])>0 and type(c['counts']) is dict and set(c['counts'])==ids);features=set()
 for f in c['features']:
  obj(f,'id label rank');ident(f['id']);ident(f['label']);need(f['rank']=='ASV' and re.fullmatch('[ACGT]{100}',f['id']) is not None and f['id'] not in features);features.add(f['id'])
 n=len(features);sparse={};used=set()
 for s,row in c['counts'].items():
  need(type(row) is list);last=-1;total=0;v={}
  for pair in row:
   need(type(pair) is list and len(pair)==2);i,k=pair;need(integer(i,0,n-1) and i>last and integer(k,1));last=i;total+=k;need(total<=SAFE);v[i]=k;used.add(i)
  need(total>0);sparse[s]=v
 need(used==set(range(n)),'unused features')
 p=x['provenance.json']
 if m['synthetic']:
  obj(p,'synthetic origin timing excludedVisits omittedEdges fitting');need(p['synthetic'] is True);ident(p['origin']);need(p['fitting']=={'status':'not-run; analytic synthetic layout'})
 else:
  obj(p,'synthetic origin timing excludedVisits omittedEdges fitting production');need(p['synthetic'] is False);ident(p['origin'])
  prod=p['production'];obj(prod,'sourceSnapshotSha256 codeSha256 taxonomy preprocessing eligibilitySha256 countsSha256 redistributionEvidence registryApproval')
  for k in ['sourceSnapshotSha256','codeSha256','eligibilitySha256','countsSha256']:need(type(prod[k]) is str and re.fullmatch('[0-9a-f]{64}',prod[k]) is not None)
  for k in ['taxonomy','preprocessing','redistributionEvidence','registryApproval']:ident(prod[k])
  inventory={f['name']:f['sha256'] for f in m['files']}
  need(prod['countsSha256']==inventory['counts.json'] and prod['eligibilitySha256']==inventory['eligibility.json'],'provenance digest binding')
  obj(p['fitting'],'backend runtime build cacheIdentity dimension seeds epochs selectionRule');need(p['fitting']['backend']=='sgd' and p['fitting']['dimension']==3 and integer(p['fitting']['epochs'],1));need(type(p['fitting']['seeds']) is list and bool(p['fitting']['seeds']) and all(integer(v) for v in p['fitting']['seeds']))
  for k in ['runtime','build','cacheIdentity','selectionRule']:ident(p['fitting'][k])
 time=p['timing'];obj(time,'precision comparisonToleranceDays origins');need(time['precision']=='integer-days' and type(time['comparisonToleranceDays']) is int and time['comparisonToleranceDays']==0 and type(time['origins']) is list);origins={};participants=set()
 for o in time['origins']:
  obj(o,'id participantId event evidence');[ident(v) for v in o.values()];need(o['id'] not in origins and o['participantId'] not in participants);need(any(r['participantId']==o['participantId'] for r in records));origins[o['id']]=o;participants.add(o['participantId'])
 referenced=set()
 for r in records:
  t=r['time']
  if t['basis']=='measured-relative':need(t['originId'] in origins and origins[t['originId']]['participantId']==r['participantId']);referenced.add(t['originId'])
 need(referenced==set(origins))
 excluded={};need(type(p['excludedVisits']) is list)
 for z in p['excludedVisits']:
  obj(z,'specimenId participantId site visitOrder evidence');[ident(z[k]) for k in ['specimenId','participantId','site','evidence']];need(number(z['visitOrder']) and z['specimenId'] in el and not el[z['specimenId']]['embeddingEligible'] and el[z['specimenId']]['role']=='skin-swab' and z['specimenId'] not in excluded);excluded[z['specimenId']]=z
 expected=set()
 for g in groups.values():
  g.sort(key=lambda r:r['visitOrder']);need(len({r['visitOrder'] for r in g})==len(g),'duplicate trajectory slot')
  for a,b in zip(g,g[1:]):
   if a['time']['basis']==b['time']['basis']=='measured-relative':need(a['time']['originId']==b['time']['originId'] and b['time']['value']>a['time']['value'],'chronology')
   expected.add((a['specimenId'],b['specimenId']))
 need(type(p['omittedEdges']) is list);omitted=set()
 for z in p['omittedEdges']:
  obj(z,'from to reason');ident(z['reason']);pair=(z['from'],z['to']);need(pair in expected and pair not in omitted);omitted.add(pair)
 if m['pairPolicy']=='complete-consecutive-trajectory-subset':need(not omitted)
 edges=x['pairs.json'];need(type(edges) is list);actual=set()
 for z in edges:
  obj(z,'from to elapsedDays speedEligible timingReason excludedVisitIds gapReason');ident(z['from']);ident(z['to']);pair=(z['from'],z['to']);need(pair in expected and pair not in actual);actual.add(pair);a,b=rr[z['from']],rr[z['to']]
  need(type(z['speedEligible']) is bool);ident(z['timingReason']);ident(z['gapReason']);stringlist(z['excludedVisitIds'])
  gaps={s for s,e in excluded.items() if e['participantId']==a['participantId'] and e['site']==a['site'] and a['visitOrder']<e['visitOrder']<b['visitOrder']};need(set(z['excludedVisitIds'])==gaps);need((z['gapReason']=='none known')==(not bool(gaps)))
  if z['speedEligible']:
   ta,tb=a['time'],b['time'];need(ta['basis']==tb['basis']=='measured-relative' and ta['originId']==tb['originId']);need(integer(z['elapsedDays'],1) and z['elapsedDays']==tb['value']-ta['value'] and z['timingReason']=='verified-calendar-interval')
  else:need(z['elapsedDays'] is None and z['timingReason']!='verified-calendar-interval')
  if m['studyId']=='10894':need(not z['speedEligible'])
 need(actual==expected-omitted and not actual&omitted)
 if m['studyId']=='11052':need(not edges,'ABTX temporal hold')
 for method in METHODS:
  b=x[method+'.json'];obj(b,'datasetId revision method context normalization targetMetric displayMetric coordinateScale coordinates diagnostics');need(b['datasetId']==m['datasetId'] and b['revision']==m['revision'] and b['method']==method and b['context']=='population' and b['displayMetric']=='euclidean' and b['coordinateScale']=='unscaled');need(b['normalization']==('l1' if method.startswith('l1') else 'max') and b['targetMetric']==('linf' if method=='max-linf' else 'euclidean'))
  co=b['coordinates'];need(type(co) is dict and set(co)==ids);need(all(type(v) is list and len(v)==3 and all(number(t) for t in v) for v in co.values()))
  d=b['diagnostics'];obj(d,'status backend objective evaluation')
  if m['synthetic']:need(d['status']=='synthetic-layout' and d['backend'] is None and d['objective'] is None)
  else:
   need(d['status']=='fitted' and d['backend']=='sgd');obj(d['objective'],'definition achieved');ident(d['objective']['definition']);need(number(d['objective']['achieved']) and d['objective']['achieved']>=0)
  ev=d['evaluation'];obj(ev,'statistic value reason pairSelection pairWeight seed candidatePairs positivePairs excludedZeroPairs');need(ev['statistic']=='rms-relative-percent' and ev['pairSelection']=='all-unordered-specimen-pairs' and ev['pairWeight']=='uniform' and ev['seed'] is None)
  need(all(integer(ev[k]) for k in ['candidatePairs','positivePairs','excludedZeroPairs']));need(ev['candidatePairs']==len(ids)*(len(ids)-1)//2==ev['positivePairs']+ev['excludedZeroPairs'])
  if ev['positivePairs']:need(number(ev['value']) and ev['value']>=0 and ev['reason'] is None)
  else:need(ev['value'] is None and ev['reason']=='no-positive-targets')
  # Independent exact geometry checks ONLY for bounded synthetic fixtures.
  if m['synthetic']:
   need(len(ids)<=64 and n<=64,'fixture evaluation bound');norm={s:{i:v/(sum(row.values()) if method.startswith('l1') else max(row.values())) for i,v in row.items()} for s,row in sparse.items()};err=[];zero=0
   for a,cid in itertools.combinations(sorted(ids),2):
    dif=[abs(norm[a].get(i,0)-norm[cid].get(i,0)) for i in norm[a].keys()|norm[cid].keys()];dt=max(dif) if method=='max-linf' else math.sqrt(sum(t*t for t in dif));dd=math.dist(co[a],co[cid])
    if dt:err.append(((dd-dt)/dt)**2)
    else:zero+=1;need(dd<=1e-12,'noncoincident duplicate')
   need(ev['positivePairs']==len(err) and ev['excludedZeroPairs']==zero)
   if err:need(abs(ev['value']-100*math.sqrt(sum(err)/len(err)))<=1e-9,'independent error')
 return {'specimens':len(ids),'edges':len(edges),'verifiedParticipants':len({r['participantId'] for r in records if el[r['specimenId']]['participantLinkEligible']})}
def validate_safe(x,m):
 try:return validate(x,m)
 except (KeyError,TypeError,IndexError,OverflowError) as e:raise Invalid(str(e)) from e
def read_bundle(path):
 path=Path(path);need(path.is_dir() and not path.is_symlink());need(all(f.is_file() and not f.is_symlink() for f in path.iterdir()));need((path/'manifest.json').is_file());m=load(path/'manifest.json');manifest(m)
 need({f.name for f in path.iterdir()}==PAYLOADS|{'manifest.json'});x={}
 for item in m['files']:
  f=path/item['name'];need(f.stat().st_size==item['bytes'] and hashlib.sha256(f.read_bytes()).hexdigest()==item['sha256'],'checksum');x[item['name']]=load(f)
 validate_safe(x,m);return x,m

def export_view(x,m,visible,method):
 """Reference pure export semantics, not a native CoSMiX implementation."""
 validate_safe(x,m);need(method in METHODS);visible=set(visible);records={r['specimenId']:r for r in x['records.json']};need(visible<=records.keys())
 def envelope():return dict(datasetId=m['datasetId'],revision=m['revision'],embedding=method,exploratory=m['exploratory'])
 specimens=[];edges=[]
 for s in sorted(visible):specimens.append(dict(envelope(),record=records[s]))
 for edge in x['pairs.json']:
  if edge['from'] in visible and edge['to'] in visible:
   a,b=records[edge['from']],records[edge['to']];edges.append(dict(envelope(),edge=edge,site=a['site'],fromOrder=a['visitOrder'],toOrder=b['visitOrder']))
 el={e['specimenId']:e for e in x['eligibility.json']}
 return dict(specimens=specimens,edges=edges,participants=sorted({records[s]['participantId'] for s in visible if el[s]['participantLinkEligible']}))
