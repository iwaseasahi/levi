# Data classification

Use the highest applicable class. Classification covers values, metadata,
filenames, screenshots, traces, backups, prompts, and derived/linkable data.

| Class        | Examples                                                                                               | Repository/agent handling                                                                                      |
| ------------ | ------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------- |
| Public       | Published source/docs; content explicitly approved for public use                                      | May be committed with provenance and license                                                                   |
| Internal     | Architecture notes, synthetic fixtures, non-sensitive aggregate test reports                           | Repository allowed; do not publish elsewhere without approval                                                  |
| Confidential | Unreleased licensed lyrics/PDFs, internal incident details, identifiable operator metadata             | No public repository or ordinary CI artifact; approved least-privilege storage only                            |
| Restricted   | Credentials, session tokens, production DB/backups, personal/pastoral data, security recovery material | Never provide to normal agents, prompts, repository, development fixtures, screenshots, traces, or ordinary CI |

Unknown legacy or imported content is Confidential until ownership, license, and
personal-data review prove otherwise. Hashes and redactions are not automatically
anonymous when they remain linkable.

Use synthetic data by default. An anonymized fixture requires an approved,
documented transform and a re-identification review before an agent receives it.
Minimize collection and retention, and document deletion/backup propagation for
every future personal-data field.
