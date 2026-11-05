"""Admission checks for the separately distributed pure 1-CST connection bank."""
import hashlib
import json

PIN = '577ae00bf8b641a406e7ae6007e22892b933dc56a18f3479121431f7fed388e1'


def checked_connections(path,population):
    raw=path.read_bytes()
    if hashlib.sha256(raw).hexdigest()!=PIN:
        raise ValueError('AGP connections differ from the reviewed pure-state analysis')
    bank=json.loads(raw)['agpConnections']
    if (bank['schema']!='agp-pure-connections-v1' or bank['sampleIds']!=population['ids'] or
        bank['pureStates']!=list(map(int,population['schemes']['90%-1-CST']['original'])) or
        bank['countSha256']!=population['countSha256'] or bank['featureSha256']!=population['featureSha256']):
        raise ValueError('AGP connection identities differ from the population')
    return raw
