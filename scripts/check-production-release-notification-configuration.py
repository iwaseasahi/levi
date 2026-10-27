#!/usr/bin/python3
"""Synthetic installation/hook guards; no Slack or production calls."""
import os
from pathlib import Path
import subprocess
import tempfile
import unittest

class InstalledConfiguration(unittest.TestCase):
    def test_units_separate_observer_and_private_delivery(self):
        root = Path(__file__).resolve().parent.parent
        service = (root / 'deploy/production/systemd/levi-release.service').read_text()
        sender = (root / 'deploy/production/systemd/levi-release-notify.service').read_text()
        timer = (root / 'deploy/production/systemd/levi-release-notify.timer').read_text()
        self.assertIn('production-release-notifications.py run', service)
        self.assertIn('ExecStopPost=-/usr/bin/python3', service)
        self.assertNotIn('slack-webhook', service)
        self.assertIn('LoadCredential=slack-webhook.url:/etc/levi/release-slack-webhook.url', sender)
        self.assertIn('ConditionPathExists=/etc/levi/release-slack-webhook.url', sender)
        self.assertIn('StateDirectoryMode=0700', sender)
        self.assertIn('NoNewPrivileges=true', sender)
        self.assertIn('production-release-notifications.py drain', sender)
        self.assertIn('OnBootSec=1m', timer)
        self.assertIn('OnUnitActiveSec=1m', timer)

    def test_installer_stages_reviewed_code_without_activation(self):
        root = Path(__file__).resolve().parent.parent
        installer = (root / 'scripts/install-production-scheduled-release.sh').read_text()
        self.assertIn('production-release-notifications.py', installer)
        self.assertIn('lib/production-release-observation.sh', installer)
        self.assertIn('levi-release-notify.service', installer)
        self.assertIn('levi-release-notify.timer', installer)
        self.assertNotRegex(installer, r'systemctl\s+(enable|start)')
        self.assertIn('wait-for-required-ci.sh', installer)

    def test_bash_hook_ignores_ssh_dry_or_missing_identity_and_handles_observer_failure(self):
        root = Path(__file__).resolve().parent
        source = (root / 'lib/production-release-observation.sh').read_text()
        self.assertNotIn('LEVI_ALLOW_TEST', source)
        with tempfile.TemporaryDirectory(prefix='levi-hook-fixture.') as directory:
            helper = Path(directory) / 'hook.sh'
            program = Path(directory) / 'observer.py'
            program.write_text('raise RuntimeError("synthetic-secret-marker")\n')
            # Only a disposable fixture changes the UID and installed path constants.
            helper.write_text(source.replace('"$EUID" -eq 0', '1 -eq 1').replace('/usr/local/lib/levi-release/scripts/production-release-notifications.py', str(program)))
            for transport, identity in [('ssh', 'f' * 32), ('local', ''), ('local', 'f' * 32)]:
                environment = {**os.environ, 'LEVI_RELEASE_TRANSPORT': transport, 'LEVI_RELEASE_OBSERVATION_ID': identity}
                result = subprocess.run(['bash', '-c', 'set -e; source "$1"; release_observe ci; echo preserved', '--', str(helper)], env=environment, capture_output=True, text=True, check=False)
                self.assertEqual(result.returncode, 0)
                self.assertIn('preserved', result.stdout)
                self.assertNotIn('synthetic-secret-marker', result.stderr)
                if transport == 'local' and identity:
                    self.assertIn('observation unavailable', result.stderr)
                else:
                    self.assertEqual(result.stderr, '')


if __name__ == '__main__':
    unittest.main()
