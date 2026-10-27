#!/usr/bin/python3
"""Private release observations and independent, bounded Slack delivery."""

import datetime
import fcntl
import http.client
import json
import os
from pathlib import Path
import re
import signal
import stat
import subprocess
import sys
import tempfile
import time
import uuid
from zoneinfo import ZoneInfo

ROOT = Path('/var/lib/levi-release-notifications')
BUNDLE = Path('/usr/local/lib/levi-release')
LAUNCHER = BUNDLE / 'scripts/run-host-scheduled-production-release.sh'
GH = BUNDLE / 'bin/gh'
HOST_HISTORY = Path('/var/lib/levi-deploy/current.env')
WEBHOOK_SOURCE = Path('/etc/levi/release-slack-webhook.url')
NOTIFIER = 'levi-release-notify.service'
SAFE_PATH = '/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin'
STAGES = {
    'clone': 'ソース取得', 'selection': '対象・前回状態の確認', 'ci': 'CI確認',
    'publish': 'イメージ作成', 'authorization': 'リリース検証',
    'host_validation': '本番適用前の検証', 'deploying': '本番状態記録', 'pull': 'イメージ取得',
    'backup': 'バックアップ', 'migration': 'migration', 'readiness': '更新・readiness',
    'recording_ready': '成功状態記録', 'cleanup': '後処理', 'complete': '完了',
}
EVENTS = {'started', 'succeeded', 'failed', 'aborted', 'unknown', 'skipped', 'test'}
SHA = re.compile(r'[a-f0-9]{40}')
ID = re.compile(r'[a-f0-9]{32}')
IMAGE = re.compile(r'ghcr\.io/iwaseasahi/(levi|levi-migrate)@sha256:[a-f0-9]{64}')
WEBHOOK = re.compile(r'https://hooks\.slack\.com/services/[A-Za-z0-9_-]+/[A-Za-z0-9_-]+/[A-Za-z0-9_-]+')
MAX_RUNS, MAX_ATTEMPTS, TTL, RETENTION = 1000, 5, 86400, 7 * 86400


def private_file(path):
    info = path.lstat()
    if not stat.S_ISREG(info.st_mode) or info.st_uid != os.geteuid() or info.st_mode & 0o077:
        raise ValueError('Unsafe private file')
    descriptor = os.open(path, os.O_RDONLY | os.O_NOFOLLOW)
    with os.fdopen(descriptor) as stream:
        value = stream.read(65537)
    if len(value) > 65536:
        raise ValueError('Private record too large')
    return value


def private_directory(path):
    path.mkdir(mode=0o700, parents=False, exist_ok=True)
    info = path.lstat()
    if not stat.S_ISDIR(info.st_mode) or info.st_uid != os.geteuid() or info.st_mode & 0o077:
        raise ValueError('Unsafe private directory')


def atomic_json(path, value):
    descriptor, name = tempfile.mkstemp(prefix='.write-', dir=path.parent)
    temporary = Path(name)
    try:
        with os.fdopen(descriptor, 'w') as stream:
            json.dump(value, stream, ensure_ascii=False, separators=(',', ':'))
            stream.flush()
            os.fsync(stream.fileno())
        os.replace(temporary, path)
        directory = os.open(path.parent, os.O_RDONLY | os.O_DIRECTORY)
        try:
            os.fsync(directory)
        finally:
            os.close(directory)
    finally:
        temporary.unlink(missing_ok=True)


class Lock:
    def __init__(self, path, nonblocking=False):
        self.path, self.nonblocking = path, nonblocking

    def __enter__(self):
        descriptor = os.open(self.path, os.O_RDWR | os.O_CREAT | os.O_NOFOLLOW, 0o600)
        self.stream = os.fdopen(descriptor, 'r+')
        info = os.fstat(descriptor)
        if info.st_uid != os.geteuid() or not stat.S_ISREG(info.st_mode) or info.st_mode & 0o077:
            self.stream.close()
            raise ValueError('Unsafe private lock')
        try:
            fcntl.flock(descriptor, fcntl.LOCK_EX | (fcntl.LOCK_NB if self.nonblocking else 0))
        except Exception:
            self.stream.close()
            raise
        return self

    def __exit__(self, *args):
        self.stream.close()


def integer(value, minimum=0, maximum=10**12):
    if type(value) is not int or not minimum <= value <= maximum:
        raise ValueError('Invalid numeric metadata')
    return value


def process_identity(pid):
    try:
        text = Path(f'/proc/{pid}/stat').read_text()
        ticks = text[text.rindex(')') + 2:].split()[19]
        boot = Path('/proc/sys/kernel/random/boot_id').read_text().strip()
        return {'pid': pid, 'ticks': ticks, 'boot': boot}
    except (OSError, ValueError, IndexError):
        return None


def alive(identity):
    return identity is not None and process_identity(identity['pid']) == identity


def validate_run(run):
    fields = {'schema_version', 'release_id', 'owner', 'child', 'started_at', 'finished_at',
              'commit', 'publish_run', 'authorization_run', 'stage', 'closed', 'skip',
              'witness', 'exit_code', 'warning', 'events'}
    if set(run) != fields or type(run['schema_version']) is not int or run['schema_version'] != 1 or not ID.fullmatch(run['release_id']):
        raise ValueError('Invalid release record')
    for identity in (run['owner'], run['child']):
        if identity is not None:
            if set(identity) != {'pid', 'ticks', 'boot'} or not re.fullmatch(r'[0-9]+', identity['ticks']) or not re.fullmatch(r'[a-f0-9-]{36}', identity['boot']):
                raise ValueError('Invalid process identity')
            integer(identity['pid'], 1)
    integer(run['started_at'])
    if run['finished_at'] is not None:
        integer(run['finished_at'], run['started_at'])
    if run['commit'] is not None and not SHA.fullmatch(run['commit']):
        raise ValueError('Invalid commit')
    for field in ('publish_run', 'authorization_run'):
        if run[field] is not None:
            integer(run[field], 1)
    if run['stage'] not in STAGES:
        raise ValueError('Invalid stage')
    for field in ('closed', 'skip', 'witness', 'warning'):
        if type(run[field]) is not bool:
            raise ValueError('Invalid state flag')
    if run['exit_code'] is not None:
        integer(run['exit_code'], 0, 255)
    if not isinstance(run['events'], list) or len(run['events']) > 2:
        raise ValueError('Invalid event list')
    seen = set()
    for event in run['events']:
        if set(event) != {'kind', 'created_at', 'stage', 'delivery', 'attempts', 'next_at'}:
            raise ValueError('Invalid event')
        if event['kind'] not in EVENTS or event['kind'] in seen or event['stage'] not in STAGES or event['delivery'] not in {'pending', 'sent', 'suppressed', 'dead'}:
            raise ValueError('Invalid event state')
        seen.add(event['kind'])
        integer(event['created_at'], run['started_at'])
        integer(event['attempts'], 0, MAX_ATTEMPTS)
        integer(event['next_at'])
    if len(seen - {'started'}) > 1 or (run['closed'] and not run['finished_at']):
        raise ValueError('Conflicting terminal state')
    if seen - {'started'} and not run['closed']:
        raise ValueError('Terminal event requires a closed release')
    if run['witness'] and (not run['commit'] or not run['authorization_run']):
        raise ValueError('Success witness requires exact release identity')
    if 'succeeded' in seen and (not run['witness'] or run['stage'] != 'complete'):
        raise ValueError('Success event lacks a host witness')
    if 'test' in seen and (len(seen) != 1 or run['commit'] is not None or run['witness']):
        raise ValueError('Notification test cannot assert a production release')
    return run


class Store:
    def __init__(self, root=None):
        self.root = ROOT if root is None else root
        private_directory(self.root)
        self.runs = self.root / 'runs'
        private_directory(self.runs)

    def lock(self):
        return Lock(self.root / 'state.lock')

    def path(self, release_id):
        if not isinstance(release_id, str) or not ID.fullmatch(release_id):
            raise ValueError('Invalid release identity')
        return self.runs / f'{release_id}.json'

    def load(self, release_id):
        run = validate_run(json.loads(private_file(self.path(release_id))))
        if run['release_id'] != release_id:
            raise ValueError('Release identity mismatch')
        return run

    def save(self, run):
        atomic_json(self.path(run['release_id']), validate_run(run))

    def all(self):
        paths = list(self.runs.iterdir())
        if len(paths) > MAX_RUNS * 3:
            raise ValueError('Release state capacity exceeded')
        return [self.load(path.stem) for path in paths if ID.fullmatch(path.stem) and path.suffix == '.json']

    def prune(self, now):
        for directory in (self.root, self.runs):
            for temporary in directory.glob('.write-*'):
                info = temporary.lstat()
                if stat.S_ISREG(info.st_mode) and info.st_uid == os.geteuid() and not info.st_mode & 0o077 and now - info.st_mtime > TTL:
                    temporary.unlink()
        for run in self.all():
            if run['closed'] and now - run['finished_at'] > RETENTION and all(event['delivery'] != 'pending' for event in run['events']):
                self.path(run['release_id']).unlink()

    def create(self, now):
        self.prune(now)
        if len(self.all()) >= MAX_RUNS:
            raise ValueError('Release state capacity reached')
        owner = process_identity(os.getpid())
        if owner is None:
            raise ValueError('Cannot identify the release process safely')
        run = {'schema_version': 1, 'release_id': uuid.uuid4().hex,
               'owner': owner, 'child': None, 'started_at': now,
               'finished_at': None, 'commit': None, 'publish_run': None, 'authorization_run': None,
               'stage': 'clone', 'closed': False, 'skip': False, 'witness': False,
               'exit_code': None, 'warning': False, 'events': []}
        if self.path(run['release_id']).exists() or self.path(run['release_id']).is_symlink():
            raise ValueError('Release identity already exists')
        self.save(run)
        return run


def enqueue(run, kind, now):
    if kind not in EVENTS:
        raise ValueError('Invalid event kind')
    if any(event['kind'] == kind for event in run['events']):
        return
    if kind != 'started' and any(event['kind'] != 'started' for event in run['events']):
        return
    run['events'].append({'kind': kind, 'created_at': max(now, run['started_at']),
                          'stage': run['stage'], 'delivery': 'pending', 'attempts': 0, 'next_at': now})


def poke_worker():
    try:
        subprocess.run(['/usr/bin/systemctl', 'start', '--no-block', NOTIFIER],
                       stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, timeout=2, check=False)
    except (OSError, subprocess.SubprocessError):
        print('Release notification worker could not be requested; the retry timer can deliver pending events.', file=sys.stderr)


def matching_history(run, ready=None):
    history = {}
    for line in private_file(HOST_HISTORY).splitlines():
        key, separator, value = line.partition('=')
        if key in {'commit', 'application_image', 'migration_image', 'approval'} and separator:
            if key in history:
                return False
            history[key] = value
    authorization = f"https://github.com/iwaseasahi/levi/actions/runs/{run['authorization_run']}"
    if set(history) != {'commit', 'application_image', 'migration_image', 'approval'} or history['commit'] != run['commit'] or history['approval'] != authorization:
        return False
    for field, repository in (('application_image', 'levi'), ('migration_image', 'levi-migrate')):
        if not re.fullmatch(rf'ghcr\.io/iwaseasahi/{repository}@sha256:[a-f0-9]{{64}}', history[field]):
            return False
        if ready is not None and history[field] != ready[field]:
            return False
    return True


def deployment_proven(run):
    if not run['commit'] or not run['authorization_run']:
        return False
    # The sender has a Slack credential directory, not the App credential directory.
    environment = {'HOME': '/root', 'PATH': SAFE_PATH, 'GH_PROMPT_DISABLED': '1'}
    try:
        result = subprocess.run([str(GH), 'api', 'repos/iwaseasahi/levi/actions/variables/LEVI_PRODUCTION_DEPLOYMENT', '--jq', '.value'],
                                env=environment, capture_output=True, text=True, timeout=20, check=True)
        ready = json.loads(result.stdout)
        if not re.fullmatch(r'[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}Z', ready['recorded_at']):
            return False
        when = datetime.datetime.fromisoformat(ready['recorded_at'].replace('Z', '+00:00')).timestamp()
        if type(ready['schema_version']) is not int or ready['schema_version'] != 1 or ready['status'] != 'ready' or ready['commit_sha'] != run['commit'] or not run['started_at'] <= when <= int(time.time()) + 60:
            return False
        authorization = f"https://github.com/iwaseasahi/levi/actions/runs/{run['authorization_run']}"
        if ready['authorization_run_url'] != authorization:
            return False
        for field, repository in (('application_image', 'levi'), ('migration_image', 'levi-migrate')):
            if not re.fullmatch(rf'ghcr\.io/iwaseasahi/{repository}@sha256:[a-f0-9]{{64}}', ready[field]):
                return False
        return matching_history(run, ready)
    except Exception:
        # API/JSON/OS diagnostics can contain protected response or credential data.
        return False


def observe(store, release_id, operation, value=None, now=None):
    now = int(time.time()) if now is None else now
    with store.lock():
        run = store.load(release_id)
        if run['closed']:
            return
        if operation in STAGES:
            if value is not None:
                raise ValueError('Unexpected observation argument')
            run['stage'] = operation
        elif operation in {'selected', 'skipped'}:
            if not isinstance(value, str) or not SHA.fullmatch(value) or (run['commit'] is not None and run['commit'] != value):
                raise ValueError('Invalid selected commit')
            run['commit'] = value
            if operation == 'selected':
                if run['skip']:
                    raise ValueError('Conflicting selection')
                enqueue(run, 'started', now)
            else:
                run['skip'] = True
        elif operation in {'publish-run', 'authorization-run'}:
            if not isinstance(value, str) or not re.fullmatch(r'[1-9][0-9]{0,11}', value):
                raise ValueError('Invalid workflow run')
            key = 'publish_run' if operation == 'publish-run' else 'authorization_run'
            if run[key] is not None and run[key] != int(value):
                raise ValueError('Workflow run identity changed')
            run[key] = int(value)
        elif operation == 'host-ready':
            # Called only by the fixed host transaction AFTER ready was written.
            # Validate its just-written history; do not add network work under its lock.
            if value != run['commit'] or not run['authorization_run'] or not matching_history(run):
                raise ValueError('Successful host deployment not proven')
            run['witness'] = True
            run['stage'] = 'complete'
        elif operation == 'cleanup-warning' and value is None:
            run['warning'] = True
        else:
            raise ValueError('Unknown release observation')
        store.save(run)
    if operation == 'selected':
        poke_worker()


def finish(store, release_id, exit_code=None, interrupted=False, now=None):
    now = int(time.time()) if now is None else now
    with store.lock():
        snapshot = store.load(release_id)
        if snapshot['closed']:
            return
    # Recovery API calls must not block observations through the private state lock.
    proof = snapshot['witness'] or (not snapshot['skip'] and deployment_proven(snapshot))
    with store.lock():
        run = store.load(release_id)
        if run['closed']:
            return
        # A positive witness already required both the host history and ready state.
        identity = ('commit', 'authorization_run', 'started_at')
        proven = run['witness'] or (proof and all(run[key] == snapshot[key] for key in identity))
        run['finished_at'] = max(now, run['started_at'])
        run['exit_code'] = exit_code
        run['closed'] = True
        if proven:
            run['witness'] = True
            run['stage'] = 'complete'
            run['warning'] = run['warning'] or exit_code not in (None, 0) or interrupted
            kind = 'succeeded'
        elif run['skip']:
            kind = 'skipped'
        elif interrupted:
            kind = 'unknown' if run['stage'] in {'deploying', 'pull', 'backup', 'migration', 'readiness', 'recording_ready', 'cleanup'} else 'aborted'
        elif exit_code == 0:
            kind = 'unknown' if run['commit'] or run['stage'] != 'clone' else None  # Window rollover before selection is silent.
        else:
            kind = 'failed'
        if kind:
            enqueue(run, kind, now)
        store.save(run)
    poke_worker()


def recover(store):
    deadline = time.monotonic() + 25
    with store.lock():
        unfinished = [run for run in store.all() if not run['closed'] and not alive(run['owner']) and not alive(run['child'])]
    for run in unfinished:
        if time.monotonic() >= deadline:
            break
        finish(store, run['release_id'], interrupted=True)


def run_release(args):
    if args not in ([], ['--dry-run']):
        raise ValueError('Invalid release runner arguments')
    if args or datetime.datetime.now(ZoneInfo('Asia/Tokyo')).strftime('%u:%H') != '2:10':
        environment = os.environ.copy()
        environment.pop('LEVI_RELEASE_OBSERVATION_ID', None)
        os.execve('/bin/bash', ['/bin/bash', str(LAUNCHER), *args], environment)
    environment = os.environ.copy()
    release_id, child, interrupted = None, None, False
    try:
        store = Store()
        with store.lock():
            run = store.create(int(time.time()))
            release_id = run['release_id']
        environment['LEVI_RELEASE_OBSERVATION_ID'] = release_id
    except Exception:
        print('Release observation unavailable; deployment checks remain authoritative.', file=sys.stderr)
    if release_id is None:
        environment.pop('LEVI_RELEASE_OBSERVATION_ID', None)

    def forward(signum, frame):
        nonlocal interrupted
        interrupted = True
        if child is not None:
            try:
                os.killpg(child.pid, signum)
            except ProcessLookupError:
                pass

    for signum in (signal.SIGTERM, signal.SIGINT, signal.SIGHUP):
        signal.signal(signum, forward)
    code = 69
    try:
        if interrupted:
            code = 143
            return code
        child = subprocess.Popen(['/bin/bash', str(LAUNCHER)], env=environment, start_new_session=True)
        if interrupted:
            forward(signal.SIGTERM, None)
        if release_id is not None:
            try:
                with store.lock():
                    current = store.load(release_id)
                    current['child'] = process_identity(child.pid)
                    store.save(current)
            except Exception:
                print('Release child observation unavailable.', file=sys.stderr)
        code = child.wait()
        code = 128 - code if code < 0 else code
    finally:
        if release_id is not None:
            try:
                finish(store, release_id, code, interrupted)
            except Exception:
                print('Release terminal observation unavailable; inspect private state.', file=sys.stderr)
    return code


def timestamp(epoch):
    return datetime.datetime.fromtimestamp(epoch, ZoneInfo('Asia/Tokyo')).strftime('%Y-%m-%d %H:%M:%S JST')


def message(run, event, now):
    validate_run(run)
    if event not in run['events']:
        raise ValueError('Unknown delivery event')
    titles = {'started': '🚀 Levi production の自動 deploy を開始しました（リリース準備）',
              'succeeded': '✅ Levi production の自動 deploy が完了しました',
              'failed': '❌ Levi production の自動 deploy 処理が失敗しました（本番状態を確認してください）',
              'aborted': '⚠️ Levi production の自動 deploy が適用前に中断しました',
              'unknown': '⚠️ Levi production の自動 deploy 結果は未確定です（本番状態を確認してください）',
              'skipped': '⏭️ Levi production の自動 deploy は変更なしのためスキップしました',
              'test': '✅ Levi deploy 通知経路の固定テストです。実際の deploy は実行していません。'}
    lines = [titles[event['kind']], '環境: production / 実行方式: ' + ('notification-test' if event['kind'] == 'test' else 'scheduled')]
    commit = run['commit']
    lines.append(f'対象: <https://github.com/iwaseasahi/levi/commit/{commit}|{commit[:7]}>' if commit else '対象: 未確定')
    lines.append(f"開始: {timestamp(run['started_at'])}")
    if event['kind'] != 'started':
        lines.append(f"終了: {timestamp(run['finished_at'])} / 所要時間: {run['finished_at'] - run['started_at']}秒")
    lines.append(f"段階: {STAGES[event['stage']]}")
    if event['kind'] == 'succeeded':
        lines.append('本番状態: ready')
    if run['warning'] and event['kind'] == 'succeeded':
        lines.append('警告: 後処理またはプロセス終了時の警告を確認してください。')
    if event['kind'] in {'failed', 'aborted', 'unknown'} and run['exit_code'] is not None:
        lines.append(f"終了コード: {run['exit_code']}")
    for key, label in (('publish_run', 'イメージ作成'), ('authorization_run', '検証')):
        if run[key]:
            lines.append(f"{label}: https://github.com/iwaseasahi/levi/actions/runs/{run[key]}")
    if now - event['created_at'] >= 60:
        lines.append(f"遅延通知: 発生 {timestamp(event['created_at'])}")
    lines.extend([f"release_id: {run['release_id']}", f"event_id: {run['release_id']}:{event['kind']}"])
    return {'text': '\n'.join(lines), 'unfurl_links': False, 'unfurl_media': False}


def slack_request(payload):
    original = WEBHOOK_SOURCE.lstat()
    if not stat.S_ISREG(original.st_mode) or original.st_uid != os.geteuid() or stat.S_IMODE(original.st_mode) != 0o600:
        raise ValueError('Unsafe original Slack credential')
    credential = Path(os.environ['CREDENTIALS_DIRECTORY']) / 'slack-webhook.url'
    url = private_file(credential).strip()
    if not WEBHOOK.fullmatch(url):
        raise ValueError('Invalid Slack credential')
    # Fixed HTTPS host, no proxies or redirects. The parent bounds DNS/overall work.
    connection = http.client.HTTPSConnection('hooks.slack.com', timeout=3)
    try:
        connection.connect()
        connection.sock.settimeout(7)
        connection.request('POST', url.removeprefix('https://hooks.slack.com'),
                           body=json.dumps(payload).encode(), headers={'Content-Type': 'application/json'})
        response = connection.getresponse()
        code, retry_after = response.status, response.getheader('Retry-After', '')
        accepted = code == 200 and response.read(64).strip() == b'ok'
        seconds = int(retry_after) if re.fullmatch(r'[0-9]{1,10}', retry_after) else 60
        return {'accepted': accepted, 'retryable': code == 429 or code >= 500,
                'retry_after': max(60, seconds) if code == 429 else 60}
    finally:
        connection.close()


def deliver(run, event):
    try:
        result = subprocess.run([sys.executable, str(Path(__file__).resolve()), 'deliver'],
                                input=json.dumps({'run': run, 'event': event}), text=True,
                                capture_output=True, timeout=10, check=True)
        response = json.loads(result.stdout)
        if set(response) != {'accepted', 'retryable', 'retry_after'} or type(response['accepted']) is not bool or type(response['retryable']) is not bool:
            raise ValueError('Invalid transport result')
        integer(response['retry_after'], 1, 10**10)
        return response
    except Exception:
        return {'accepted': False, 'retryable': True, 'retry_after': 60}


def drain(store):
    failed = False
    deadline = time.monotonic() + 60
    with Lock(store.root / 'worker.lock', nonblocking=True):
        recover(store)
        for _ in range(20):
            if time.monotonic() >= deadline:
                break
            now = int(time.time())
            with store.lock():
                store.prune(now)
                cooldown_path = store.root / 'cooldown.json'
                cooldown = json.loads(private_file(cooldown_path)) if cooldown_path.exists() else {'next_at': 0}
                if set(cooldown) != {'next_at'} or integer(cooldown['next_at']) > now:
                    break
                candidates = []
                for run in store.all():
                    failed = failed or any(event['delivery'] == 'dead' for event in run['events'])
                    terminal_sent = any(event['kind'] != 'started' and event['delivery'] == 'sent' for event in run['events'])
                    changed = False
                    for event in run['events']:
                        if event['delivery'] != 'pending':
                            continue
                        if event['kind'] == 'started' and terminal_sent:
                            event['delivery'], changed = 'suppressed', True
                        elif now - event['created_at'] >= TTL or event['attempts'] >= MAX_ATTEMPTS:
                            event['delivery'], changed, failed = 'dead', True, True
                        elif event['next_at'] <= now:
                            candidates.append((event['kind'] == 'started', event['created_at'], run['release_id'], event['kind']))
                    if changed:
                        store.save(run)
                if not candidates:
                    break
                _, _, release_id, kind = min(candidates)
                run = store.load(release_id)
                event = next(event for event in run['events'] if event['kind'] == kind)
                event['attempts'] += 1
                event['next_at'] = now + 60  # Persist before HTTP: a killed sender cannot loop forever.
                store.save(run)
                attempt = event['attempts']
                atomic_json(cooldown_path, {'next_at': now + 1})
            response = deliver(run, event)  # Never hold the state/deployment lock during HTTP.
            with store.lock():
                current = store.load(release_id)
                pending = next(event for event in current['events'] if event['kind'] == kind)
                if pending['attempts'] != attempt or pending['delivery'] != 'pending':
                    raise ValueError('Delivery state changed unexpectedly')
                after = int(time.time())
                if response['accepted']:
                    pending['delivery'] = 'sent'
                    if kind != 'started':
                        for earlier in current['events']:
                            if earlier['kind'] == 'started' and earlier['delivery'] == 'pending':
                                earlier['delivery'] = 'suppressed'
                    print(f"Release notification delivered: {release_id}:{kind}")
                elif not response['retryable'] or attempt >= MAX_ATTEMPTS or after + response['retry_after'] >= event['created_at'] + TTL:
                    pending['delivery'], failed = 'dead', True
                    print(f"Release notification delivery failed permanently: {release_id}:{kind}", file=sys.stderr)
                else:
                    pending['next_at'], failed = after + response['retry_after'], True
                    print(f"Release notification queued for retry: {release_id}:{kind}", file=sys.stderr)
                store.save(current)
                atomic_json(cooldown_path, {'next_at': max(after + 1, after + response['retry_after'] if not response['accepted'] else after + 1)})
            if response['accepted']:
                time.sleep(1)
            else:
                break
    return 1 if failed else 0


def queue_test(store):
    with store.lock():
        now = int(time.time())
        run = store.create(now)
        run['closed'], run['finished_at'], run['stage'] = True, now, 'complete'
        enqueue(run, 'test', now)
        store.save(run)
    poke_worker()
    print(f"Fixed notification test queued: {run['release_id']}:test")
    return 0


def main(args):
    if os.geteuid() != 0:
        raise ValueError('Release notifications are restricted to root')
    if not args:
        raise ValueError('Missing notification operation')
    operation, *values = args
    if operation == 'run':
        return run_release(values)
    if operation == 'deliver' and not values:
        data = json.loads(sys.stdin.read(65537))
        payload = message(data['run'], data['event'], int(time.time()))
        try:
            response = slack_request(payload)
        except (OSError, http.client.HTTPException):
            response = {'accepted': False, 'retryable': True, 'retry_after': 60}
        print(json.dumps(response))
        return 0
    store = Store()
    if operation == 'queue-test' and not values:
        return queue_test(store)
    if operation == 'observe' and len(values) in (2, 3):
        observe(store, *values)
        return 0
    if operation == 'recover' and not values:
        recover(store)
        return 0
    if operation == 'drain' and not values:
        return drain(store)
    if operation == 'status' and not values:
        with store.lock():
            runs = store.all()
            print(json.dumps({'unfinished': sum(not run['closed'] for run in runs),
                              **{state: sum(event['delivery'] == state for run in runs for event in run['events']) for state in ('pending', 'sent', 'dead', 'suppressed')}}))
        return 0
    raise ValueError('Invalid notification operation')


if __name__ == '__main__':
    try:
        sys.exit(main(sys.argv[1:]))
    except BlockingIOError:
        sys.exit(0)  # Another delivery worker is already responsible for the queue.
    except Exception:
        print('Release notification operation failed; inspect private state/configuration without displaying secrets.', file=sys.stderr)
        sys.exit(69)
