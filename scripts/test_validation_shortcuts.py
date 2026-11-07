"""Check shortcut routing without loading datasets or running the layout audit."""
import json
import os
from pathlib import Path
import shutil
import subprocess
import sys
import tempfile
import unittest

SOURCE = Path(__file__).resolve().parent


class ValidationShortcuts(unittest.TestCase):
    def test_routing(self):
        with tempfile.TemporaryDirectory(prefix='vme shortcuts ') as temp:
            base = Path(temp)
            scripts = base / 'source with spaces' / 'scripts'
            scripts.mkdir(parents=True)
            for name in ('vme-test', 'vme-test-audit', 'vme-test-layout', 'cosmix-test', 'cosmix-test-audit', 'cosmix-test-layout', 'micove-test', 'micove-test-audit', 'micove-test-layout'):
                shutil.copy2(SOURCE / name, scripts / name)
            bindir = base / 'bin'
            bindir.mkdir()
            node = bindir / 'node'
            node.write_text('#!' + sys.executable + '\nimport json,sys\nprint(json.dumps(sys.argv[1:]))\nsys.exit(17)\n')
            node.chmod(0o755)
            env = {**os.environ, 'HOME': str(base / 'home'), 'PATH': str(bindir) + os.pathsep + os.defpath}
            env.pop('VME_TEST_PAGE', None)
            env.pop('COSMIX_TEST_PAGE', None)
            env.pop('MICOVE_TEST_PAGE', None)
            runner = str(scripts / '../rank2_feature_graph/verify_http_assets.mjs')

            def run(name, *args, environment=env):
                return subprocess.run([str(scripts / name), *args], cwd=base,
                                      env=environment, capture_output=True, text=True)

            routes = [('vme-test', [], 'verify_http_assets.mjs'), ('vme-test-audit', ['--audit-layouts'], 'verify_http_assets.mjs'), ('vme-test-layout', [], 'verify_graph_layout.mjs')]
            routes += [(name.replace('vme-', prefix), flags, target) for name, flags, target in list(routes) for prefix in ('cosmix-', 'micove-')]
            for name, flags, target in routes:
                runner = str(scripts / '../rank2_feature_graph' / target)
                with self.subTest(command=name):
                    result = run(name)
                    self.assertEqual(result.returncode, 17, 'Propagate the test exit status')
                    self.assertEqual(json.loads(result.stdout), [runner, env['HOME'] + '/micove/web/index.html', *flags])
                    custom = {**env, 'VME_TEST_PAGE': '/custom build/index.http.html'}
                    result = run(name, environment=custom)
                    self.assertEqual(json.loads(result.stdout), [runner, custom['VME_TEST_PAGE'], *flags])
                    custom = {**custom, 'COSMIX_TEST_PAGE': '/current build/index.http.html'}
                    result = run(name, environment=custom)
                    self.assertEqual(json.loads(result.stdout), [runner, custom['COSMIX_TEST_PAGE'], *flags])
                    custom = {**custom, 'MICOVE_TEST_PAGE': '/new build/index.html'}
                    self.assertEqual(json.loads(run(name, environment=custom).stdout), [runner, custom['MICOVE_TEST_PAGE'], *flags])
                    result = run(name, '/explicit build/index.html', environment=custom)
                    self.assertEqual(json.loads(result.stdout), [runner, '/explicit build/index.html', *flags])
                    result = run(name, '--help')
                    self.assertEqual(result.returncode, 0)
                    self.assertIn('Usage:', result.stdout)
                    for args in [('--unknown',), ('one.html', 'two.html')]:
                        self.assertEqual(run(name, *args).returncode, 2)
            for name, flags, target in routes:
                runner = str(scripts / '../rank2_feature_graph' / target)
                legacy = Path(env['HOME']) / 'vme/web/index.html'
                current = Path(env['HOME']) / 'micove/web/index.html'
                legacy.parent.mkdir(parents=True, exist_ok=True)
                legacy.write_text('legacy fixture')
                current.unlink(missing_ok=True)
                self.assertEqual(json.loads(run(name).stdout), [runner, str(legacy), *flags])
                current.parent.mkdir(parents=True, exist_ok=True)
                current.write_text('current fixture')
                self.assertEqual(json.loads(run(name).stdout), [runner, str(current), *flags])
            self.assertEqual(run('cosmix-test-layout', '--audit-layouts').returncode, 2)
            self.assertEqual(run('vme-test-layout', '--audit-layouts').returncode, 2)
            runner = str(scripts / '../rank2_feature_graph/verify_http_assets.mjs')
            result = run('vme-test', '--audit-layouts', '/explicit build/index.html')
            self.assertEqual(json.loads(result.stdout), [runner, '/explicit build/index.html', '--audit-layouts'])


if __name__ == '__main__':
    unittest.main()
