# Manual production image publication and deployment

## Safety boundary

Production publication and deployment are manual workflows. Nothing in this repository deploys on push, merge, a schedule, or a model/API call. A release needs all of the following:

1. an exact 40-character commit already merged into `main`;
2. successful `Quality`, `Database`, `E2E`, and `Security` checks for that exact commit;
3. immutable application and migration image digests carrying the same commit revision label;
4. an Issue comment approving that exact commit, both digests, migration impact, rollback/forward-recovery choice, and timing;
5. approval on the GitHub `production` Environment;
6. a day other than Sunday in `Asia/Tokyo`.

The GitHub workflow and host script independently reject Sunday. There is no emergency bypass. An incident on Sunday uses restore/rollback procedures only after the separate immediate high-impact approval; it is not treated as a normal deploy.

## One-time GitHub configuration

After the domain and VPS exist and the live checks in
[`xserver-domain-cutover.md`](xserver-domain-cutover.md) pass, the repository
owner configures these settings manually:

- create the Environment named exactly `production`;
- require the Levi operator as reviewer and enable prevention of self-review when the GitHub plan supports it;
- restrict deployment branches/tags to `main`;
- add Environment secrets `PRODUCTION_SSH_HOST`, `PRODUCTION_SSH_USER`, `PRODUCTION_SSH_PRIVATE_KEY`, and pinned `PRODUCTION_SSH_KNOWN_HOSTS`;
- add repository variable `PRODUCTION_BASE_URL` with the exact value
  `https://levi-system.com`.

Do not create `PRODUCTION_BASE_URL` before the endpoint is live. Its presence
enables the scheduled external smoke workflow, and that workflow deliberately
rejects any other origin.

Before the first administration deployment, generate the Basic password
verifier with `pnpm admin:hash-password` and configure
`ADMIN_BASIC_AUTH_USERNAME` and `ADMIN_BASIC_AUTH_PASSWORD_HASH` in the host's
protected `production.env`. Follow
[`admin-basic-auth.md`](admin-basic-auth.md); never store the plaintext password
or verifier in GitHub Issues, workflow inputs, or repository files.

Do not use `ssh-keyscan` inside the deployment workflow as the trust decision. Record the host key through the WebARENA console/out-of-band setup and pin it. Environment secrets are created only after VPS provisioning is separately approved.

## One-time host entrypoint installation

GitHub Actions must not receive a reusable root password or unrestricted sudo
access. After `/opt/levi` has been checked out at the reviewed release commit,
the operator installs the root-owned deployment entrypoint once from an
interactive SSH session:

```bash
sudo /opt/levi/scripts/install-production-deploy-entrypoint.sh
sudo visudo -cf /etc/sudoers.d/levi-production-deploy
sudo -l
```

The resulting sudoers policy grants `levi-system-operator` passwordless access
only to `/usr/local/sbin/levi-production-deploy`. The wrapper accepts exactly a
commit, two immutable image digests, and an approval comment URL. It validates
all four values, requires the commit to be on `origin/main`, checks out that
commit in the fixed root-owned `/opt/levi` repository, clears the caller's
environment, and then invokes the fixed production deployment script. It does
not grant passwordless access to `git`, `env`, `docker`, a shell, or arbitrary
scripts.

To revoke GitHub Actions deployment access, use an interactive sudo session and
remove only these exact installed files:

```bash
sudo rm /etc/sudoers.d/levi-production-deploy
sudo rm /usr/local/sbin/levi-production-deploy
```

This rollback removes the automation entrypoint; it does not stop the running
application or remove production data.

## Publish immutable images

Run `Publish production images` manually with the approved commit. It rechecks the four CI jobs, builds `linux/amd64` images from `Dockerfile.production` and `Dockerfile.migrate.production`, labels both with the commit SHA, pushes commit-only tags to GHCR, and prints both immutable digests in the workflow summary. It does not deploy.

This workflow writes package artifacts and can consume GitHub package storage; confirm the account's current billing/allowance before the first dispatch. Because the source repository is public and neither image contains a database dump, secret, or Bible data, the intended pull model is public GHCR packages without a VPS registry credential. Changing the two package visibilities to public is a separate human action after first publication. Until that is approved and complete, deployment will fail safely at `docker pull`.

Copy the two digest references into the release Issue. Never deploy a mutable tag such as `latest` or a bare commit tag.

## Approve and deploy

The immediate approval comment must state the commit, application digest, migration digest, backup status, expected user impact, forward-recovery plan, and responsible operator. Then manually run `Deploy production` with those exact values and the comment URL.

The workflow checks CI and main ancestry before it reaches the protected `production` Environment. After the Environment reviewer approves, it connects with pinned SSH host keys and calls the command-scoped deployment entrypoint with `sudo -n`. The entrypoint independently validates the inputs and main ancestry, checks out the exact commit, clears the SSH caller's environment, and invokes `production-deploy.sh`. The host script:

- validates the commit, digests, approval URL, and Sunday freeze again;
- verifies each OCI revision label equals the commit;
- validates Compose and takes a fresh encrypted hourly backup;
- runs forward-only Prisma migrations through the isolated admin migration image;
- starts Caddy, application, and PostgreSQL and waits for readiness;
- records commit, digests, approval, and UTC time in immutable-by-convention history under `/var/lib/levi-deploy/history/` and updates `/var/lib/levi-deploy/current.env`.

## Failed deployment and recovery

Do not reverse an applied migration. If the new application fails and the migration is backward compatible, obtain an immediate approval and redeploy the previous application digest while keeping the current schema. If it is not backward compatible, stop traffic and implement a tested forward migration/fix from a new commit. Use database restore only for verified data corruption, following `backup-restore.md`; it invalidates every session.

Never delete the previous image, `levi_rollback_*` database, or recovery evidence during incident response. Record observed readiness, 5xx window, commit/digests, migration result, data-loss estimate, decision owner, church notification time, and final outcome in the incident Issue.

## Sunday change freeze

No application deploy, Compose change, package update, OS reboot, schema migration, seed, or data import is scheduled on Sunday Japan time. Complete routine changes by Saturday, and prefer Monday through Thursday. On Sunday, the operator performs read-only health checks and communicates incidents; any destructive recovery remains governed by its own immediate approval.
