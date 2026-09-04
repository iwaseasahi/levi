# ADR 0016: Store bounded Slide images in PostgreSQL

- Status: accepted
- Date: 2026-09-04
- Decision owner: Levi product owner
- Extends: [ADR 0015](0015-church-owned-slides.md)

## Context

Issue #470 adds one optional image surface as an alternative to the existing
text surface. The current production scope is two churches on one WebARENA VPS.
The product owner selected server-contained storage rather than S3 for this
scale, and accepted the effect on database size and restore time provided that
tenant quotas, capacity monitoring, and image-aware restore verification are
part of acceptance.

Images are church-created content. Public object URLs, filesystem paths shared
by the application container, and browser-persisted copies would add access,
backup, and deletion boundaries that the current deployment does not need.

## Decision

Store normalized image bytes in PostgreSQL `bytea` in a one-to-one
`slide_images` row. A Slide is exactly one of `TEXT` or `IMAGE`; an image Slide
has one image and no body. The child row repeats `church_id` and uses a composite
foreign key so tenant ownership is enforced in the database. Slide/church
physical deletion cascades to the bytes.

Accept JPEG, PNG, and static WebP uploads up to 10 MiB. Decode before trusting
the media type, reject animation and decompression bombs, apply orientation,
strip metadata, and re-encode. Bound dimensions to 8,192 pixels per side and 40
million pixels. Serve bytes only through the authenticated, church-scoped route
for the exact Slide revision, with `private, no-store` and `nosniff` headers.

`SlideImageStorage` is the application boundary for image persistence. Its
PostgreSQL implementation keeps quota accounting and Slide mutation in one
transaction. A future S3 implementation may change the physical schema and add
compensation for database/object-store writes without changing image validation,
HTTP authorization, or presentation code.

Set `SLIDE_IMAGE_BYTES_PER_CHURCH` explicitly in production. One GiB is the
development/test and example value, not an approved production entitlement.
Deployment remains blocked until the operator approves the actual value. Lock
the Church row before summing and writing image bytes so concurrent uploads
cannot exceed the quota. Alert when any church reaches 80% of its configured
quota and retain the existing 80% host/backup filesystem thresholds.

## Consequences

### Positive

- Image authorization, deletion, transaction, backup, and restore follow the
  existing church/database boundary.
- No cloud credentials, public object namespace, signed URL lifecycle, or new
  production service is required at the current scale.
- Normalization makes stored bytes bounded and presentation behavior stable.

### Negative and risks

- Database and encrypted backup size grow with image use; PostgreSQL must send
  the bytes for each authenticated display.
- On-host database and backups retain the single-VPS failure boundary in ADR 0005. This is not disaster recovery.
- A later object-store migration requires a forward data migration and careful
  dual-write/cutover design; the interface limits application coupling but does
  not make that migration free.

## Alternatives considered

### Private S3 with short-lived signed URLs

This scales storage and delivery independently, but adds cloud credentials,
object/database consistency, lifecycle policy, cross-tenant key design, and
another production dependency. Reconsider when measured storage or delivery
load justifies it.

### Files in a server directory

This avoids database byte growth but creates a second durable volume whose
atomicity, backup, restore, permissions, orphan cleanup, and container mounts
must be operated separately. It is not selected for the present two-church
scope.

## Compatibility and version policy

The schema change is forward-only. Existing rows become `TEXT`; rollback may
leave the new tables/columns unused. `sharp` is a direct production dependency
because the platform/runtime APIs do not provide bounded, metadata-stripping
image decode and re-encode.

## Reconsider when

- approved image quota or measured total image bytes materially pressure the
  VPS disk, database latency, backup window, or 120-minute restore objective;
- projection traffic makes authenticated database delivery a bottleneck;
- off-host durability or disaster recovery becomes required; or
- the deployment moves away from the single-VPS topology.

## Verification

- Domain and decoder tests cover type, byte, dimension, pixel, animation, and
  metadata rules.
- Integration tests cover tenant isolation, quota concurrency, replacement,
  and physical deletion.
- Browser tests cover upload, preview, 16:9 `contain` projection, and blanking.
- The backup rehearsal contains synthetic image bytes and reconciles the actual
  restored byte hash within the existing RTO check.

## References

- [Issue #470](https://github.com/iwaseasahi/levi/issues/470)
- [Slide contract](../product/slide-contract.md)
- [Backup and restore](../operations/backup-restore.md)
