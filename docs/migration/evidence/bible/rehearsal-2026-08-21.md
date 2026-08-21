# Bible migration rehearsal — 2026-08-21

## Sign-off

- Execution: completed by Codex using the guarded local Compose rehearsal
  runner.
- Scope: disposable local databases only; production execution was false.
- Source authorization: product owner confirmed display rights, JSS3 and NKJV
  mapping, preservation of all source rows including five empty texts, and test
  use.
- Production approval: not requested and not granted by this evidence.

## Versions and fingerprints

| Item                             | Value                                                              |
| -------------------------------- | ------------------------------------------------------------------ |
| Runner                           | `levi-ginmaku-bible-rehearsal` v1                                  |
| Source report                    | v2                                                                 |
| Target schema                    | 6 migrations; `20260821101000_saved_content`                       |
| Source bytes                     | 37,585,883                                                         |
| Source SHA-256                   | `5600e06968a78c32227094678444fc7a028c76d338276044d5d9c1c629eb2bd7` |
| Book fingerprint                 | `e3a28589131a21a9e6778ecc1e6401847d47067ff55757bbb8af9cfe70e5423b` |
| Name fingerprint                 | `fbab5f03c21770abc95cc59717df26bb4535dae09f8cf4935289ebf41ae582e6` |
| Location fingerprint             | `dcbdda443d81886b673bf6181809b580a23e1db8a187b95147282b9242045809` |
| Content fingerprint              | `91c697d7806df0a5c81726fea929dd5ded248a9847b187b78c5c2ff27709a4ef` |
| Deterministic sample fingerprint | `4b2ba50a1d0ccb7810b23d9520810161db637eda739553d5c5dc0bd6f4ad4908` |
| Transient report SHA-256         | `e775d970268fdc17735798ceee8a8b5c4aa8a5fe8107aa51c4b6d62522f1740c` |

## Anonymous reconciliation

| Metric                    |                                     Source | Before | After failure | After import | Restored |
| ------------------------- | -----------------------------------------: | -----: | ------------: | -----------: | -------: |
| Translations              |                                          2 |      2 |             2 |            2 |        2 |
| Books                     |                                         66 |      0 |             0 |           66 |       66 |
| Book names                | 66 source rows / 132 localized target rows |      0 |             0 |          132 |      132 |
| Chapters, JSS3            |                                      1,189 |      0 |             0 |        1,189 |    1,189 |
| Chapters, NKJV            |                                      1,189 |      0 |             0 |        1,189 |    1,189 |
| Verses, JSS3              |                                     31,220 |      0 |             0 |       31,220 |   31,220 |
| Verses, NKJV              |                                     31,105 |      0 |             0 |       31,105 |   31,105 |
| Paired locations          |                                     31,103 |      0 |             0 |       31,103 |   31,103 |
| Empty texts, JSS3 / NKJV  |                                      5 / 0 |  0 / 0 |         0 / 0 |        5 / 0 |    5 / 0 |
| Verse zero, JSS3 / NKJV   |                                    116 / 0 |  0 / 0 |         0 / 0 |      116 / 0 |  116 / 0 |
| Texts containing newlines |                                          0 |      0 |             0 |            0 |        0 |

Source validation found zero duplicate locations, invalid keys, NULL values, or
verse gaps. JSS3 has 117 unpaired locations and NKJV has 2; these source
differences were preserved rather than repaired or omitted.

## Outcomes

- Dry run selected import without writing.
- The injected failure after the first 500-row batch returned
  `IMPORT_INJECTED_FAILURE`; every before/after-failure count matched.
- Clean import completed and full plus deterministic sample fingerprints
  matched the source.
- Immediate rerun returned `unchanged`.
- The custom backup archive was restored into a second disposable database;
  all counts and full/sample fingerprints matched again.
- No Bible text, credentials, personal data, or production connection details
  are present in this evidence.
