"""Validate the separately supplied, frozen AGP outcome display export."""
import itertools
import json
import math
import portable as p

IDENTITY = '2805acb3d1da21309e0e972bc8cc6d05489ebc3138776c60c90130b454c870fd'
PIN = 'f0fd6dff63278ea2ea61ab41d99efb602526b0e3c7e4811581c0f23e781e99fb'
POLICIES = ('index', 'all_visits')
OUTCOMES = ('seasonal_allergies', 'skin_condition', 'ibs')
METHODS = ('knn', 'case_raw', 'case_corrected')
SCOPES = ('global', 'state')
KINDS = ('outer', 'final')


def validate(data, population):
    if data.get('version') != 1 or data.get('identity') != IDENTITY:
        raise ValueError('Unsupported AGP outcome analysis identity')
    if any(data.get(k) != population[k] for k in ('countSha256', 'featureSha256')):
        raise ValueError('AGP outcome abundance population differs')
    ids = data['sample']
    if len(ids) != len(set(ids)) or len(ids) != 24411:
        raise ValueError('AGP outcome sample identifiers are not unique and complete')
    by_id = dict(zip(population['ids'], population['schemes']['70%-1-CST']['merged']))
    if len(data['state']) != len(ids) or any(s not in by_id or by_id[s] != t for s, t in zip(ids, data['state'])):
        raise ValueError('AGP outcome frozen 70%-1-CST memberships differ')
    if len(population['ids']) != 24421 or set(data['labels']) != set(population['schemes']['70%-1-CST']['cores']):
        raise ValueError('AGP outcome reference differs')
    index = data['index']
    if len(index) != 21323 or len(set(index)) != len(index) or any(type(i) is not int or i < 0 or i >= len(ids) for i in index):
        raise ValueError('Invalid AGP index-sample policy')
    keys = {'__'.join(parts) for parts in itertools.product(POLICIES, OUTCOMES, METHODS, SCOPES, KINDS)}
    if set(data['series']) != keys or set(data['outcomes']) != set(OUTCOMES):
        raise ValueError('AGP outcome combinations are incomplete')
    primary = set(index)
    for key, values in data['series'].items():
        if len(values) != len(ids):
            raise ValueError('AGP outcome array length differs')
        for i, v in enumerate(values):
            available = not key.startswith('index__') or i in primary
            if available != (v is not None) or (v is not None and (type(v) not in (float, int) or not math.isfinite(v) or not 0 <= v <= 1)):
                raise ValueError('AGP outcome probability or unavailable mask differs')
    for values in data['outcomes'].values():
        if len(values) != len(ids) or any(v is not None and (type(v) is not int or v not in (0, 1)) for v in values):
            raise ValueError('Invalid AGP observed answer')
    return data


def checked_outcomes(path, population):
    raw = path.read_bytes()
    if p.sha(raw) != PIN:
        raise ValueError('AGP outcome estimates differ from the reviewed export')
    validate(json.loads(raw)['agpOutcomeEstimates'], population)
    return raw
