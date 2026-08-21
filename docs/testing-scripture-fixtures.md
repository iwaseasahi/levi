# Scripture test fixtures

The product owner approved using real Bible passages in automated tests on
2026-08-21. This approval does not permit copying rows from the production dump
into the repository.

The latest-Chrome search and projection fixture uses Genesis 1:1 so assertions
exercise recognizable content instead of only placeholder strings:

- JSS3: sourced from the published “福音聖句42（新改訳聖書第3版）” excerpt at
  <https://www.jcmessage.jp/siryou/2013/fukuin42.pdf>.
- NKJV: sourced from the published Genesis 1:1 NKJV page at
  <https://www.biblegateway.com/passage/?search=Genesis1%3A1&version=NKJV>.

Additional verses in the navigation fixture remain visibly marked test text.
This keeps the reviewed copyrighted excerpt minimal while still allowing
previous/next and direct-selection behavior to be tested. Test failures should
assert selectors and state rather than print whole response payloads.
