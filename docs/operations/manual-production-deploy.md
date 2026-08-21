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

After a domain and VPS exist, the repository owner configures these settings manually:

- create the Environment named exactly `production`;
- require the Levi operator as reviewer and enable prevention of self-review when the GitHub plan supports it;
- restrict deployment branches/tags to `main`;
- add Environment secrets `PRODUCTION_SSH_HOST`, `PRODUCTION_SSH_USER`, `PRODUCTION_SSH_PRIVATE_KEY`, and pinned `PRODUCTION_SSH_KNOWN_HOSTS`;
- add repository variable `PRODUCTION_BASE_URL` as the exact HTTPS origin.

Do not use `ssh-keyscan` inside the deployment workflow as the trust decision. Record the host key through the WebARENA console/out-of-band setup and pin it. Environment secrets are created only after VPS provisioning is separately approved.

## Publish immutable images

Run `Publish production images` manually with the approved commit. It rechecks the four CI jobs, builds `linux/amd64` images from `Dockerfile` and `Dockerfile.migrate`, labels both with the commit SHA, pushes commit-only tags to GHCR, and prints both immutable digests in the workflow summary. It does not deploy.

This workflow writes package artifacts and can consume GitHub package storage; confirm the account's current billing/allowance before the first dispatch. Because the source repository is public and neither image contains a database dump, secret, or Bible data, the intended pull model is public GHCR packages without a VPS registry credential. Changing the two package visibilities to public is a separate human action after first publication. Until that is approved and complete, deployment will fail safely at `docker pull`.

Copy the two digest references into the release Issue. Never deploy a mutable tag such as `latest` or a bare commit tag.

## Approve and deploy

The immediate approval comment must state the commit, application digest, migration digest, backup status, expected user impact, forward-recovery plan, and responsible operator. Then manually run `Deploy production` with those exact values and the comment URL.

The workflow checks CI and main ancestry before it reaches the protected `production` Environment. After the Environment reviewer approves, it connects with pinned SSH host keys, checks out the exact commit, and invokes `production-deploy.sh`. The host script:

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
