# Data classification

Use the highest applicable class. Classification covers values, metadata,
filenames, screenshots, traces, backups, prompts, and derived/linkable data.

| Class        | Examples                                                                                                                                                                                   | Repository/agent handling                                                                                      |
| ------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------- |
| Public       | Published source/docs; content explicitly approved for public use                                                                                                                          | May be committed with provenance and license                                                                   |
| Internal     | Architecture notes, synthetic fixtures, non-sensitive aggregate test reports                                                                                                               | Repository allowed; do not publish elsewhere without approval                                                  |
| Confidential | Church-created folder/bookmark names and prepared text/images, image metadata, unreleased licensed lyrics/PDFs, email addresses, internal incident details, identifiable operator metadata | No public repository or ordinary CI artifact; approved least-privilege storage only                            |
| Restricted   | Credentials, session tokens, production DB/backups, personal/pastoral data, security recovery material                                                                                     | Never provide to normal agents, prompts, repository, development fixtures, screenshots, traces, or ordinary CI |

Unknown legacy or imported content is Confidential until ownership, license, and
personal-data review prove otherwise. Hashes and redactions are not automatically
anonymous when they remain linkable.

Opaque synthetic UUIDs used only by deterministic tests are Internal. Production
church, user, folder, bookmark, and session identifiers are at least
Confidential when they can be linked to a tenant or person. Structured logs may
retain an approved opaque actor/target ID for security audit correlation, but
must not contain church-created names/content, email, request query/params,
credentials, or session material.

Use synthetic data by default. An anonymized fixture requires an approved,
documented transform and a re-identification review before an agent receives it.
Minimize collection and retention, and document deletion/backup propagation for
every future personal-data field.

Slide images are Confidential even when their visible subject appears public:
the upload, tenant association, title, dimensions, hash, and timing remain
church-owned context. Decode and normalize before persistence; do not log the
filename, bytes, title, checksum, or decoder error details. Image bytes may
appear only in the production database and encrypted database backups, and must
not be attached to Issues, traces, screenshots, or ordinary CI artifacts.
