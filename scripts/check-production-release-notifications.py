#!/usr/bin/python3
"""Synthetic release-state and Slack transport tests; no real network/secrets."""

import contextlib
import copy
import importlib.util
import io
import json
import os
from pathlib import Path
import runpy
import subprocess
import sys
import tempfile
import types
import unittest
from unittest.mock import MagicMock, patch

sys.dont_write_bytecode = True
SCRIPT = Path(__file__).with_name('production-release-notifications.py')
spec = importlib.util.spec_from_file_location('release_notifications', SCRIPT)
notify = importlib.util.module_from_spec(spec)
spec.loader.exec_module(notify)
REAL_PROOF = notify.deployment_proven
REAL_DELIVER = notify.deliver
REAL_IDENTITY = notify.process_identity
NOW = 1793062800
COMMIT = 'a' * 40
APP = 'ghcr.io/iwaseasahi/levi@sha256:' + 'b' * 64
MIGRATION = 'ghcr.io/iwaseasahi/levi-migrate@sha256:' + 'c' * 64
URL = 'https://github.com/iwaseasahi/levi/actions/runs/200'
ACCEPTED = {'accepted': True, 'retryable': False, 'retry_after': 60}
RETRY = {'accepted': False, 'retryable': True, 'retry_after': 60}


class ReleaseNotifications(unittest.TestCase):
    def setUp(self):
        self.directory = tempfile.TemporaryDirectory(prefix='levi-synthetic-notifications.')
        self.root = Path(self.directory.name)
        self.history = self.root / 'current.env'
        self.webhook = self.root / 'webhook.url'
        self.webhook.write_text('synthetic-unused-secret')
        self.webhook.chmod(0o600)
        self.stack = contextlib.ExitStack()
        self.addCleanup(self.stack.close)
        self.addCleanup(self.directory.cleanup)
        self.clock = self.stack.enter_context(patch.object(notify.time, 'time', return_value=NOW))
        self.stack.enter_context(patch.object(notify.time, 'sleep'))
        self.poke = self.stack.enter_context(patch.object(notify, 'poke_worker'))
        self.proof = self.stack.enter_context(patch.object(notify, 'deployment_proven', return_value=False))
        self.stack.enter_context(patch.object(notify, 'alive', return_value=True))
        self.stack.enter_context(patch.object(notify, 'HOST_HISTORY', self.history))
        self.stack.enter_context(patch.object(notify, 'WEBHOOK_SOURCE', self.webhook))
        self.stack.enter_context(patch.object(notify, 'process_identity', side_effect=lambda pid: {'pid': pid, 'ticks': '100', 'boot': '00000000-0000-0000-0000-000000000000'}))
        self.store = notify.Store(self.root / 'state')
        with self.store.lock():
            self.run = self.store.create(NOW)
        self.release_id = self.run['release_id']
        # A fake transport is always installed, including tests not expecting delivery.
        self.send = self.stack.enter_context(patch.object(notify, 'deliver', return_value=ACCEPTED))

    def observe(self, operation, value=None):
        notify.observe(self.store, self.release_id, operation, value)

    def load(self):
        return self.store.load(self.release_id)

    def history_file(self, **changes):
        values = {'commit': COMMIT, 'application_image': APP, 'migration_image': MIGRATION, 'approval': URL}
        values.update(changes)
        self.history.write_text(''.join(f'{key}={value}\n' for key, value in values.items()))
        self.history.chmod(0o600)

    def selected(self):
        self.observe('selected', COMMIT)
        self.observe('authorization-run', '200')

    def finish(self, code=0, **kwargs):
        notify.finish(self.store, self.release_id, code, **kwargs)

    def succeeded(self, code=0):
        self.selected()
        self.history_file()
        self.observe('host-ready', COMMIT)
        self.finish(code)

    def event(self, kind):
        return next(event for event in self.load()['events'] if event['kind'] == kind)

    def test_success_requires_host_witness_after_ready_and_retains_ids(self):
        self.succeeded()
        run = self.load()
        self.assertEqual([event['kind'] for event in run['events']], ['started', 'succeeded'])
        text = notify.message(run, run['events'][-1], NOW)['text']
        self.assertIn('本番状態: ready', text)
        self.assertIn('2026-10-27 10:00:00 JST', text)
        self.assertIn(self.release_id, text)
        self.assertIn(URL, text)

    def test_exit_zero_alone_cannot_report_success(self):
        self.selected()
        self.finish()
        self.assertEqual(self.load()['events'][-1]['kind'], 'unknown')

    def test_early_authentication_or_clone_error_has_unknown_commit(self):
        self.finish(69)
        run = self.load()
        self.assertEqual([event['kind'] for event in run['events']], ['failed'])
        self.assertIn('対象: 未確定', notify.message(run, run['events'][0], NOW)['text'])

    def test_each_failure_stage_is_reported_without_success(self):
        for stage in notify.STAGES:
            with self.store.lock():
                run = self.store.create(NOW)
            notify.observe(self.store, run['release_id'], 'selected', COMMIT)
            notify.observe(self.store, run['release_id'], stage)
            notify.finish(self.store, run['release_id'], 1)
            event = self.store.load(run['release_id'])['events'][-1]
            self.assertEqual((event['kind'], event['stage']), ('failed', stage))

    def test_no_change_emits_only_one_skip(self):
        self.observe('skipped', COMMIT)
        self.finish()
        self.assertEqual([event['kind'] for event in self.load()['events']], ['skipped'])

    def test_race_already_applied_is_skip_after_start(self):
        self.selected()
        self.observe('skipped', COMMIT)
        self.finish()
        self.assertEqual([event['kind'] for event in self.load()['events']], ['started', 'skipped'])
        self.proof.assert_not_called()

    def test_window_rollover_without_selection_is_silent(self):
        self.finish()
        self.assertEqual(self.load()['events'], [])

    def test_finish_and_observation_are_idempotent(self):
        self.succeeded()
        before = self.load()
        self.finish(1)
        self.observe('ci')
        self.assertEqual(self.load(), before)

    def test_interruption_before_apply_is_aborted(self):
        self.selected()
        self.observe('publish')
        self.finish(143, interrupted=True)
        self.assertEqual(self.load()['events'][-1]['kind'], 'aborted')

    def test_interruption_during_apply_is_unknown(self):
        self.selected()
        self.observe('migration')
        self.finish(143, interrupted=True)
        self.assertEqual(self.load()['events'][-1]['kind'], 'unknown')

    def test_post_ready_error_remains_success_with_warning(self):
        self.succeeded(1)
        self.assertEqual(self.load()['events'][-1]['kind'], 'succeeded')
        self.assertTrue(self.load()['warning'])

    def test_cleanup_warning_is_retained_after_success(self):
        self.observe('cleanup-warning')
        self.succeeded()
        self.assertTrue(self.load()['warning'])

    def test_host_witness_rejects_foreign_history_or_authorization(self):
        self.selected()
        for changes in ({'commit': 'f' * 40}, {'approval': URL + '1'}, {'application_image': 'mutable:tag'}):
            self.history_file(**changes)
            with self.assertRaises(ValueError):
                self.observe('host-ready', COMMIT)
            self.assertFalse(self.load()['witness'])

    def test_recovery_does_not_finalize_live_parent_or_child(self):
        with patch.object(notify, 'alive', side_effect=[True, False, True]):
            notify.recover(self.store)
            notify.recover(self.store)
        self.assertFalse(self.load()['closed'])

    def test_reboot_recovery_resolves_ready_proof_once_without_redeploy(self):
        self.selected()
        self.observe('readiness')
        self.proof.return_value = True
        with patch.object(notify, 'alive', return_value=False):
            notify.recover(self.store)
            notify.recover(self.store)
        self.assertEqual(self.load()['events'][-1]['kind'], 'succeeded')
        self.assertEqual(self.proof.call_count, 1)

    def test_unresolved_reboot_during_apply_is_unknown(self):
        self.selected()
        self.observe('deploying')
        with patch.object(notify, 'alive', return_value=False):
            notify.recover(self.store)
        self.assertEqual(self.load()['events'][-1]['kind'], 'unknown')

    def test_proof_requires_exact_ready_timestamp_images_and_host_record(self):
        self.selected()
        self.history_file()
        ready = {'schema_version': 1, 'status': 'ready', 'commit_sha': COMMIT,
                 'application_image': APP, 'migration_image': MIGRATION,
                 'authorization_run_url': URL, 'recorded_at': '2026-10-27T01:00:00Z'}
        def proven(value):
            result = types.SimpleNamespace(stdout=json.dumps(value))
            with patch.object(notify.subprocess, 'run', return_value=result) as call:
                success = REAL_PROOF(self.load())
                self.assertNotIn('CREDENTIALS_DIRECTORY', call.call_args.kwargs['env'])
                self.assertNotIn('GH_TOKEN', call.call_args.kwargs['env'])
                return success
        self.assertTrue(proven(ready))
        for changes in ({'status': 'deploying'}, {'commit_sha': 'f' * 40}, {'application_image': 'mutable:tag'},
                        {'authorization_run_url': URL + '1'}, {'recorded_at': '2026-10-26T01:00:00Z'},
                        {'recorded_at': '2026-10-27T01:00:00'}, {'recorded_at': '2026-10-28T01:00:00Z'}):
            self.assertFalse(proven({**ready, **changes}))
        self.history_file(migration_image='ghcr.io/iwaseasahi/levi-migrate@sha256:' + 'd' * 64)
        self.assertFalse(proven(ready))

    def test_proof_failures_are_private_and_preserve_uncertainty(self):
        self.selected()
        with patch.object(notify.subprocess, 'run', side_effect=RuntimeError('synthetic-secret-marker')):
            self.assertFalse(REAL_PROOF(self.load()))

    def test_recovery_network_does_not_hold_store_lock(self):
        self.selected()
        def check_lock(run):
            with notify.Lock(self.store.root / 'state.lock', nonblocking=True):
                return False
        self.proof.side_effect = check_lock
        self.finish()
        self.assertEqual(self.load()['events'][-1]['kind'], 'unknown')

    def test_terminal_delivery_suppresses_late_start(self):
        self.succeeded()
        self.assertEqual(notify.drain(self.store), 0)
        self.assertEqual(self.event('succeeded')['delivery'], 'sent')
        self.assertEqual(self.event('started')['delivery'], 'suppressed')
        self.assertEqual(self.send.call_count, 1)

    def test_started_delivery_does_not_require_terminal_event(self):
        self.selected()
        notify.drain(self.store)
        self.assertEqual(self.event('started')['delivery'], 'sent')

    def test_delivery_timeout_has_bounded_retry_and_cannot_change_release_success(self):
        self.succeeded()
        self.send.return_value = RETRY
        self.assertEqual(notify.drain(self.store), 1)
        event = self.event('succeeded')
        self.assertEqual((event['attempts'], event['next_at'], event['delivery']), (1, NOW + 60, 'pending'))
        self.assertTrue(self.load()['witness'])
        self.assertEqual(self.load()['exit_code'], 0)
        self.assertEqual(self.load()['events'][-1]['kind'], 'succeeded')

    def test_retry_after_is_respected_across_worker_runs(self):
        self.observe('skipped', COMMIT)
        self.finish()
        self.send.return_value = {**RETRY, 'retry_after': 300}
        notify.drain(self.store)
        self.clock.return_value = NOW + 299
        notify.drain(self.store)
        self.assertEqual(self.send.call_count, 1)
        self.clock.return_value = NOW + 300
        self.send.return_value = ACCEPTED
        notify.drain(self.store)
        self.assertEqual(self.send.call_count, 2)

    def test_five_attempt_limit_is_durable(self):
        self.observe('skipped', COMMIT)
        self.finish()
        self.send.return_value = RETRY
        for number in range(7):
            self.clock.return_value = NOW + number * 60
            notify.drain(self.store)
        self.assertEqual(self.send.call_count, 5)
        self.assertEqual(self.event('skipped')['delivery'], 'dead')

    def test_expired_event_or_retry_after_beyond_lifetime_is_not_sent_again(self):
        self.observe('skipped', COMMIT)
        self.finish()
        self.clock.return_value = NOW + notify.TTL
        self.assertEqual(notify.drain(self.store), 1)
        self.send.assert_not_called()
        self.assertEqual(self.event('skipped')['delivery'], 'dead')

    def test_oversized_retry_after_expires_event(self):
        self.observe('skipped', COMMIT)
        self.finish()
        self.send.return_value = {**RETRY, 'retry_after': notify.TTL + 1}
        notify.drain(self.store)
        self.assertEqual(self.event('skipped')['delivery'], 'dead')

    def test_permanent_four_xx_is_not_retried(self):
        self.observe('skipped', COMMIT)
        self.finish()
        self.send.return_value = {'accepted': False, 'retryable': False, 'retry_after': 60}
        notify.drain(self.store)
        self.clock.return_value = NOW + 120
        notify.drain(self.store)
        self.assertEqual(self.send.call_count, 1)
        self.assertEqual(self.event('skipped')['delivery'], 'dead')

    def test_sender_does_not_hold_state_lock_during_http(self):
        self.selected()
        def deliver(run, event):
            with notify.Lock(self.store.root / 'state.lock', nonblocking=True):
                pass
            return ACCEPTED
        self.send.side_effect = deliver
        notify.drain(self.store)
        self.assertEqual(self.event('started')['delivery'], 'sent')

    def test_concurrent_sender_is_excluded(self):
        self.selected()
        with notify.Lock(self.store.root / 'worker.lock'):
            with self.assertRaises(BlockingIOError):
                notify.drain(self.store)
        self.send.assert_not_called()

    def test_corrupt_record_cannot_add_arbitrary_message_fields(self):
        run = self.load()
        run['raw_log'] = 'synthetic-secret-marker'
        with self.assertRaises(ValueError):
            self.store.save(run)
        with self.assertRaises(ValueError):
            notify.message(run, {}, NOW)

    def test_untrusted_metadata_is_rejected(self):
        for operation, value in [('selected', '<!channel>'), ('authorization-run', '1\nsecret'), ('raw-log', 'secret')]:
            with self.assertRaises(ValueError):
                self.observe(operation, value)
        with self.assertRaises(ValueError):
            self.store.load('../outside')

    def test_forged_success_event_without_witness_is_rejected(self):
        self.selected()
        run = self.load()
        run['closed'], run['finished_at'] = True, NOW
        notify.enqueue(run, 'succeeded', NOW)
        with self.assertRaises(ValueError):
            self.store.save(run)

    def test_private_modes_and_symlink_denials(self):
        self.assertEqual(self.store.root.stat().st_mode & 0o777, 0o700)
        target = self.store.path(self.release_id)
        self.assertEqual(target.stat().st_mode & 0o777, 0o600)
        target.chmod(0o644)
        with self.assertRaises(ValueError):
            self.load()
        target.chmod(0o600)
        link = self.root / 'link'
        link.symlink_to(target)
        with self.assertRaises(ValueError):
            notify.private_file(link)
        directory = self.root / 'linked-state'
        directory.symlink_to(self.store.root)
        with self.assertRaises(ValueError):
            notify.Store(directory)

    def test_private_lock_rejects_public_modes_and_symlinks(self):
        lock = self.root / 'public.lock'
        lock.write_text('')
        lock.chmod(0o644)
        with self.assertRaises(ValueError), notify.Lock(lock):
            pass
        link = self.root / 'linked.lock'
        link.symlink_to(lock)
        with self.assertRaises(OSError), notify.Lock(link):
            pass

    def test_retention_and_capacity_are_bounded(self):
        self.observe('skipped', COMMIT)
        self.finish()
        notify.drain(self.store)
        with self.store.lock():
            self.store.prune(NOW + notify.RETENTION + 1)
        self.assertEqual(self.store.all(), [])
        with patch.object(notify, 'MAX_RUNS', 1):
            with self.store.lock():
                self.store.create(NOW)
                with self.assertRaises(ValueError):
                    self.store.create(NOW)

    def test_interrupted_atomic_write_does_not_corrupt_queue(self):
        (self.store.runs / '.write-synthetic').write_text('unfinished')
        self.assertEqual(len(self.store.all()), 1)
        self.selected()
        self.assertEqual(self.load()['commit'], COMMIT)

    def test_uuid_collision_cannot_replace_existing_release(self):
        with patch.object(notify.uuid, 'uuid4', return_value=types.SimpleNamespace(hex=self.release_id)):
            with self.store.lock(), self.assertRaises(ValueError):
                self.store.create(NOW)
        self.assertEqual(self.load(), self.run)

    def test_transport_connect_and_read_timeouts_no_redirect_and_no_raw_response(self):
        response = MagicMock(status=302)
        response.getheader.return_value = ''
        response.read.return_value = b'synthetic-secret-marker'
        connection = MagicMock()
        connection.getresponse.return_value = response
        url = 'https://hooks.slack.com/services/SYNTHETIC/TEST/NOT-A-REAL-SECRET'
        with patch.dict(os.environ, {'CREDENTIALS_DIRECTORY': str(self.root)}), patch.object(notify, 'private_file', return_value=url), patch.object(notify.http.client, 'HTTPSConnection', return_value=connection) as connect:
            value = notify.slack_request({'text': 'synthetic'})
        connect.assert_called_once_with('hooks.slack.com', timeout=3)
        connection.sock.settimeout.assert_called_once_with(7)
        self.assertEqual(value, {'accepted': False, 'retryable': False, 'retry_after': 60})
        self.assertNotIn('synthetic-secret-marker', json.dumps(value))
        self.assertEqual(connection.request.call_count, 1)

    def test_slack_response_classification(self):
        connection = MagicMock()
        url = 'https://hooks.slack.com/services/SYNTHETIC/TEST/NOT-A-REAL-SECRET'
        with patch.dict(os.environ, {'CREDENTIALS_DIRECTORY': str(self.root)}), patch.object(notify, 'private_file', return_value=url), patch.object(notify.http.client, 'HTTPSConnection', return_value=connection):
            for code, accepted, retryable in [(200, True, False), (400, False, False), (403, False, False), (404, False, False), (429, False, True), (500, False, True)]:
                response = MagicMock(status=code)
                response.getheader.return_value = '300'
                response.read.return_value = b'ok'
                connection.getresponse.return_value = response
                value = notify.slack_request({'text': 'synthetic'})
                self.assertEqual((value['accepted'], value['retryable']), (accepted, retryable))
                self.assertEqual(value['retry_after'], 300 if code == 429 else 60)

    def test_webhook_origin_validation(self):
        for url in ['http://hooks.slack.com/services/a/b/c', 'https://other.invalid/services/a/b/c', 'https://hooks.slack.com@other.invalid/services/a/b/c', 'https://hooks.slack.com/services/a/b/c?secret=bad']:
            with patch.dict(os.environ, {'CREDENTIALS_DIRECTORY': str(self.root)}), patch.object(notify, 'private_file', return_value=url), patch.object(notify.http.client, 'HTTPSConnection') as connection:
                with self.assertRaises(ValueError):
                    notify.slack_request({'text': 'synthetic'})
                connection.assert_not_called()

    def test_original_webhook_file_must_be_private_even_if_systemd_copy_is_private(self):
        self.webhook.chmod(0o644)
        with patch.object(notify.http.client, 'HTTPSConnection') as connection, self.assertRaises(ValueError):
            notify.slack_request({'text': 'synthetic'})
        connection.assert_not_called()

    def test_delivery_subprocess_has_overall_deadline_and_no_secret_arguments(self):
        self.selected()
        run, event = self.load(), self.load()['events'][0]
        with patch.object(notify.subprocess, 'run', side_effect=subprocess.TimeoutExpired('synthetic', 10)) as call:
            response = REAL_DELIVER(run, event)
        self.assertEqual(response, RETRY)
        self.assertEqual(call.call_args.kwargs['timeout'], 10)
        self.assertEqual(call.call_args.args[0][-1], 'deliver')
        self.assertNotIn('hooks.slack.com', str(call.call_args))

    def test_cli_exception_output_is_redacted(self):
        output = io.StringIO()
        with patch.object(sys, 'argv', [str(SCRIPT), 'drain']), patch.object(os, 'geteuid', return_value=0), patch.object(Path, 'mkdir', side_effect=RuntimeError('synthetic-secret-marker')), contextlib.redirect_stderr(output), self.assertRaises(SystemExit) as result:
            runpy.run_path(str(SCRIPT), run_name='__main__')
        self.assertEqual(result.exception.code, 69)
        self.assertNotIn('synthetic-secret-marker', output.getvalue())

    def test_cli_rejects_nonroot_before_any_network_or_state(self):
        with patch.object(os, 'geteuid', return_value=123), patch.object(notify, 'Store') as store, self.assertRaises(ValueError):
            notify.main(['drain'])
        store.assert_not_called()
        self.send.assert_not_called()

    def test_process_identity_uses_boot_and_kernel_start_ticks_not_pid_alone(self):
        text = '123 (name with ) spaces) ' + ' '.join(['S'] + ['0'] * 18 + ['12345'] + ['0'] * 3)
        def read(path):
            return '00000000-0000-0000-0000-000000000001\n' if str(path).endswith('boot_id') else text
        with patch.object(Path, 'read_text', read):
            self.assertEqual(REAL_IDENTITY(123), {'pid': 123, 'ticks': '12345', 'boot': '00000000-0000-0000-0000-000000000001'})

    def test_zombie_process_does_not_block_recovery(self):
        text = '123 (dead process) ' + ' '.join(['Z'] + ['0'] * 18 + ['12345'])
        with patch.object(Path, 'read_text', return_value=text):
            self.assertIsNone(REAL_IDENTITY(123))

    def test_runner_preserves_exit_code_and_binds_child_observations(self):
        child = MagicMock(pid=123)
        selected_id = []
        def spawn(*args, **kwargs):
            release_id = kwargs['env']['LEVI_RELEASE_OBSERVATION_ID']
            selected_id.append(release_id)
            def wait():
                notify.observe(self.store, release_id, 'selected', COMMIT)
                notify.observe(self.store, release_id, 'migration')
                return 17
            child.wait.side_effect = wait
            return child
        clock = MagicMock()
        clock.datetime.now.return_value.strftime.return_value = '2:10'
        with patch.object(notify, 'Store', return_value=self.store), patch.object(notify, 'datetime', clock), patch.object(notify.signal, 'signal'), patch.object(notify.subprocess, 'Popen', side_effect=spawn) as popen:
            self.assertEqual(notify.run_release([]), 17)
        run = self.store.load(selected_id[0])
        self.assertEqual(run['events'][-1]['kind'], 'failed')
        self.assertEqual(run['exit_code'], 17)
        self.assertTrue(popen.call_args.kwargs['start_new_session'])
        self.assertEqual(popen.call_args.args[0], ['/bin/bash', str(notify.LAUNCHER)])

    def test_observation_store_failure_does_not_prevent_or_duplicate_deployment(self):
        child = MagicMock(pid=123)
        child.wait.return_value = 0
        clock = MagicMock()
        clock.datetime.now.return_value.strftime.return_value = '2:10'
        with patch.object(notify, 'Store', side_effect=ValueError('synthetic-secret-marker')), patch.object(notify, 'datetime', clock), patch.object(notify.signal, 'signal'), patch.object(notify.subprocess, 'Popen', return_value=child) as popen, patch.dict(os.environ, {'LEVI_RELEASE_OBSERVATION_ID': 'f' * 32}), contextlib.redirect_stderr(io.StringIO()) as output:
            self.assertEqual(notify.run_release([]), 0)
        self.assertEqual(popen.call_count, 1)
        self.assertNotIn('LEVI_RELEASE_OBSERVATION_ID', popen.call_args.kwargs['env'])
        self.assertNotIn('synthetic-secret-marker', output.getvalue())

    def test_dry_run_and_outside_window_clear_inherited_observation_identity(self):
        for args, window in [(['--dry-run'], '2:10'), ([], '3:10')]:
            clock = MagicMock()
            clock.datetime.now.return_value.strftime.return_value = window
            with patch.object(notify, 'datetime', clock), patch.dict(os.environ, {'LEVI_RELEASE_OBSERVATION_ID': 'f' * 32}), patch.object(notify.os, 'execve', side_effect=SystemExit(0)) as execute, patch.object(notify, 'Store') as store:
                with self.assertRaises(SystemExit):
                    notify.run_release(args)
            self.assertNotIn('LEVI_RELEASE_OBSERVATION_ID', execute.call_args.args[2])
            store.assert_not_called()

    def test_signal_is_forwarded_and_lost_apply_result_is_unknown(self):
        child = MagicMock(pid=123)
        child.poll.return_value = None
        handlers = {}
        selected_id = []
        def spawn(*args, **kwargs):
            release_id = kwargs['env']['LEVI_RELEASE_OBSERVATION_ID']
            selected_id.append(release_id)
            def wait():
                notify.observe(self.store, release_id, 'selected', COMMIT)
                notify.observe(self.store, release_id, 'migration')
                handlers[notify.signal.SIGTERM](notify.signal.SIGTERM, None)
                return -15
            child.wait.side_effect = wait
            return child
        clock = MagicMock()
        clock.datetime.now.return_value.strftime.return_value = '2:10'
        with patch.object(notify, 'Store', return_value=self.store), patch.object(notify, 'datetime', clock), patch.object(notify.signal, 'signal', side_effect=lambda sig, handler: handlers.update({sig: handler})), patch.object(notify.os, 'killpg') as kill, patch.object(notify.subprocess, 'Popen', side_effect=spawn):
            self.assertEqual(notify.run_release([]), 143)
        kill.assert_called_once_with(123, notify.signal.SIGTERM)
        self.assertEqual(self.store.load(selected_id[0])['events'][-1]['kind'], 'unknown')

    def test_observer_clock_failure_falls_back_to_existing_launcher_guard(self):
        clock = MagicMock()
        clock.datetime.now.side_effect = ValueError('synthetic-private-clock-marker')
        with patch.object(notify, 'datetime', clock), patch.object(notify.os, 'execve', side_effect=SystemExit(0)) as execute, contextlib.redirect_stderr(io.StringIO()) as output:
            with self.assertRaises(SystemExit):
                notify.run_release([])
        self.assertEqual(execute.call_args.args[1], ['/bin/bash', str(notify.LAUNCHER)])
        self.assertNotIn('synthetic-private-clock-marker', output.getvalue())

    def test_fixed_test_entrypoint_never_claims_or_runs_production_deploy(self):
        with patch.object(notify, 'run_release') as deploy:
            self.assertEqual(notify.queue_test(self.store), 0)
        deploy.assert_not_called()
        tests = [run for run in self.store.all() if any(event['kind'] == 'test' for event in run['events'])]
        self.assertEqual(len(tests), 1)
        text = notify.message(tests[0], tests[0]['events'][0], NOW)['text']
        self.assertIn('固定テスト', text)
        self.assertIn('実際の deploy は実行していません', text)
        self.assertNotIn('本番状態: ready', text)
        self.assertIsNone(tests[0]['commit'])


if __name__ == '__main__':
    unittest.main()
