"""Admission of the separately distributed, graph-only AGP layout bank."""
import hashlib
import json

PIN='a6708bcb806408ae6ec8037317d3ceabba5a7f74c8abb75f45e97981504bc15e'

def checked_layouts(path,population_path):
    raw=path.read_bytes()
    if hashlib.sha256(raw).hexdigest()!=PIN:
        raise ValueError('AGP connection layouts differ from the reviewed graph fits')
    bank=json.loads(raw)['agpConnectionLayouts'];data=json.loads(population_path.read_bytes())
    if (bank['schema']!='agp-connection-layouts-v1' or bank['countSha256']!=data['countSha256'] or
        bank['featureSha256']!=data['featureSha256']):raise ValueError('AGP graph layout identities differ')
    for name,checksum in bank['identity']['sources'].items():
        if hashlib.sha256(population_path.with_name(name).read_bytes()).hexdigest()!=checksum:
            raise ValueError('AGP graph layout source differs: '+name)
    return raw
