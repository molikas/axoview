# Changelog

All notable changes to Axoview will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [2.0.1](https://github.com/molikas/axoview/compare/v2.0.0...v2.0.1) (2026-06-10)

### Bug Fixes

* **app:** disable session-mode save when no diagram is open ([#19](https://github.com/molikas/axoview/issues/19)) ([cf2ebde](https://github.com/molikas/axoview/commit/cf2ebde8b80a850266e09a1e7aebcd4c54cf1976))

## [2.0.0](https://github.com/molikas/axoview/compare/v1.0.0...v2.0.0) (2026-05-23)

### ⚠ BREAKING CHANGES

* **v1.1:** deployers running custom backends must update any
health-monitoring that polls /api/storage/status. The /healthz endpoint
(added in Wave 3a per ADR 0010 D8) is the canonical liveness probe.
* **v1.1:** removes HTTP_AUTH_USER/HTTP_AUTH_PASSWORD env vars and
the nginx-level Basic Auth layer. Deployers who relied on Basic Auth
must switch to AUTH_MODE=shared-token (per ADR 0009 D4) before
upgrading.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>

* chore: stage long-pending tactical deletions + gitignore playwright artifacts

- Add packages/axoview-e2e/.gitignore covering playwright-report/ and
  test-results/. Defense in depth even though the whole packages/axoview-e2e/

### Chores

* **v1.1:** dead-code wave — Track 0 (clusters 0a-0h, ~9.4k LOC removed) ([#3](https://github.com/molikas/axoview/issues/3)) ([6d33f1b](https://github.com/molikas/axoview/commit/6d33f1b0d4e8fa8b869d6d04d4ab7d6805912b25)), closes [#A9](https://github.com/molikas/axoview/issues/A9) [#A3](https://github.com/molikas/axoview/issues/A3) [#A9](https://github.com/molikas/axoview/issues/A9) [#C2](https://github.com/molikas/axoview/issues/C2) [#4](https://github.com/molikas/axoview/issues/4) [#5](https://github.com/molikas/axoview/issues/5) [#11](https://github.com/molikas/axoview/issues/11) [#11](https://github.com/molikas/axoview/issues/11) [#C2](https://github.com/molikas/axoview/issues/C2) [#C5](https://github.com/molikas/axoview/issues/C5) [#D3](https://github.com/molikas/axoview/issues/D3) [#C1](https://github.com/molikas/axoview/issues/C1) [#C1](https://github.com/molikas/axoview/issues/C1) [#C4](https://github.com/molikas/axoview/issues/C4) [#D1](https://github.com/molikas/axoview/issues/D1) [#D2](https://github.com/molikas/axoview/issues/D2) [#12](https://github.com/molikas/axoview/issues/12) [#12](https://github.com/molikas/axoview/issues/12) [#13](https://github.com/molikas/axoview/issues/13) [#8](https://github.com/molikas/axoview/issues/8) [#4](https://github.com/molikas/axoview/issues/4) [#A2](https://github.com/molikas/axoview/issues/A2) [#14](https://github.com/molikas/axoview/issues/14) [#A5](https://github.com/molikas/axoview/issues/A5) [#14](https://github.com/molikas/axoview/issues/14) [#A5](https://github.com/molikas/axoview/issues/A5) [#A5](https://github.com/molikas/axoview/issues/A5) [#A1](https://github.com/molikas/axoview/issues/A1) [#A1](https://github.com/molikas/axoview/issues/A1) [#1](https://github.com/molikas/axoview/issues/1) [#4](https://github.com/molikas/axoview/issues/4) [#2](https://github.com/molikas/axoview/issues/2) [#15](https://github.com/molikas/axoview/issues/15) [#15](https://github.com/molikas/axoview/issues/15) [#A8](https://github.com/molikas/axoview/issues/A8) [#A8](https://github.com/molikas/axoview/issues/A8) [#16](https://github.com/molikas/axoview/issues/16) [#A1](https://github.com/molikas/axoview/issues/A1) [#A7](https://github.com/molikas/axoview/issues/A7) [#16](https://github.com/molikas/axoview/issues/16) [#5](https://github.com/molikas/axoview/issues/5) [#6](https://github.com/molikas/axoview/issues/6) [#5](https://github.com/molikas/axoview/issues/5) [#6](https://github.com/molikas/axoview/issues/6)

## 1.0.0 (2026-05-23)

### ⚠ BREAKING CHANGES

* deployers running custom backends must update any
health-monitoring that polls /api/storage/status. The /healthz endpoint
(added in Wave 3a per ADR 0010 D8) is the canonical liveness probe.
* removes HTTP_AUTH_USER/HTTP_AUTH_PASSWORD env vars and
the nginx-level Basic Auth layer. Deployers who relied on Basic Auth
must switch to AUTH_MODE=shared-token (per ADR 0009 D4) before
upgrading.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>

* chore: stage long-pending tactical deletions + gitignore playwright artifacts

- Add packages/axoview-e2e/.gitignore covering playwright-report/ and
  test-results/. Defense in depth even though the whole packages/axoview-e2e/

* Productization audit — ship to master ([#1](https://github.com/molikas/axoview/issues/1)) ([7838ff2](https://github.com/molikas/axoview/commit/7838ff22f3c7dd1e55b627ece542d322396fa05c)), closes [#A9](https://github.com/molikas/axoview/issues/A9) [#A3](https://github.com/molikas/axoview/issues/A3) [#A9](https://github.com/molikas/axoview/issues/A9) [#C2](https://github.com/molikas/axoview/issues/C2) [#4](https://github.com/molikas/axoview/issues/4) [#5](https://github.com/molikas/axoview/issues/5) [#11](https://github.com/molikas/axoview/issues/11) [#11](https://github.com/molikas/axoview/issues/11) [#C2](https://github.com/molikas/axoview/issues/C2) [#C5](https://github.com/molikas/axoview/issues/C5) [#D3](https://github.com/molikas/axoview/issues/D3) [#3](https://github.com/molikas/axoview/issues/3) [#C1](https://github.com/molikas/axoview/issues/C1) [#C1](https://github.com/molikas/axoview/issues/C1) [#C4](https://github.com/molikas/axoview/issues/C4) [#D1](https://github.com/molikas/axoview/issues/D1) [#D2](https://github.com/molikas/axoview/issues/D2) [#12](https://github.com/molikas/axoview/issues/12) [#12](https://github.com/molikas/axoview/issues/12) [#13](https://github.com/molikas/axoview/issues/13) [#8](https://github.com/molikas/axoview/issues/8) [#4](https://github.com/molikas/axoview/issues/4) [#A2](https://github.com/molikas/axoview/issues/A2) [#14](https://github.com/molikas/axoview/issues/14) [#A5](https://github.com/molikas/axoview/issues/A5) [#14](https://github.com/molikas/axoview/issues/14) [#A5](https://github.com/molikas/axoview/issues/A5) [#A5](https://github.com/molikas/axoview/issues/A5) [#A1](https://github.com/molikas/axoview/issues/A1) [#A1](https://github.com/molikas/axoview/issues/A1) [#3](https://github.com/molikas/axoview/issues/3) [#4](https://github.com/molikas/axoview/issues/4) [#2](https://github.com/molikas/axoview/issues/2) [#15](https://github.com/molikas/axoview/issues/15) [#15](https://github.com/molikas/axoview/issues/15) [#A8](https://github.com/molikas/axoview/issues/A8) [#A8](https://github.com/molikas/axoview/issues/A8) [#16](https://github.com/molikas/axoview/issues/16) [#A1](https://github.com/molikas/axoview/issues/A1) [#A7](https://github.com/molikas/axoview/issues/A7) [#16](https://github.com/molikas/axoview/issues/16) [#5](https://github.com/molikas/axoview/issues/5) [#6](https://github.com/molikas/axoview/issues/6) [#5](https://github.com/molikas/axoview/issues/5) [#6](https://github.com/molikas/axoview/issues/6)

### Features

* 2026.5.9 — item-type parity + UX consistency, slider scrollbar fix ([042908f](https://github.com/molikas/axoview/commit/042908f242da009d383c553889790c53662052a4))
* accepts an array of textboxes as part of initialData ([aaf48bd](https://github.com/molikas/axoview/commit/aaf48bd33e97fcf3a87a9adef68451440f15a3ed))
* Add advanced pan controls with configurable options ([83c9b3a](https://github.com/molikas/axoview/commit/83c9b3aed21f5881cf8c0025ba37043d580de914)), closes [#25](https://github.com/molikas/axoview/issues/25)
* add click-based connector creation mode with empty space support ([#108](https://github.com/molikas/axoview/issues/108)) ([5ff21cc](https://github.com/molikas/axoview/commit/5ff21cc35fcf86b7e71b539ff5700039dfc3667e)), closes [#84](https://github.com/molikas/axoview/issues/84)
* add clickable link support to node headers ([a7b2940](https://github.com/molikas/axoview/commit/a7b294005ccfb824df6a2266367c5a575ffa31f0))
* add close button to item control components ([a808b83](https://github.com/molikas/axoview/commit/a808b8376fcf912d628188d691fec98c2f619bdb))
* add comprehensive tests for connector reducer and improve CI/CD coverage reporting ([70b1f56](https://github.com/molikas/axoview/commit/70b1f560a24fa63c57241a3974ebcf381e701e5f))
* Add configurable hotkey system for tools ([ef258df](https://github.com/molikas/axoview/commit/ef258dff17884660c2c99e78ecef736852156cc7)), closes [#59](https://github.com/molikas/axoview/issues/59)
* add Copy share link to file tree context menu ([5accf70](https://github.com/molikas/axoview/commit/5accf70f462f8cef4a4e2997b9aa096c48eb5672))
* add Ctrl+X cut/paste; update docs, hotkeys, tests ([87b527f](https://github.com/molikas/axoview/commit/87b527fd20d6958c9d8f6c0d2f55ff6b7a0b9f51))
* Add custom icon import functionality with automatic scaling ([dd80e86](https://github.com/molikas/axoview/commit/dd80e86de275524835084d26d52d560e3bc970f8))
* add Delete key shortcut, lasso select, context menu restore, and fix test suite ([41f3191](https://github.com/molikas/axoview/commit/41f3191f6f1e49679c0cd8e74271170fdb8fa1df))
* add German translations ([1624d16](https://github.com/molikas/axoview/commit/1624d1662c024b1d42e6f6f6a2a97e68437d873b))
* add Help dialog and shortcut key support ([d500460](https://github.com/molikas/axoview/commit/d5004607db8bfbacb1c80a4d7ebedd6ba590d514))
* add i18n to main menu & docs: update Chinese README ([#130](https://github.com/molikas/axoview/issues/130)) ([a001da7](https://github.com/molikas/axoview/commit/a001da7edb0c81574a9fcbcbec30272cacf44591))
* add indonesian language ([#186](https://github.com/molikas/axoview/issues/186)) [@akmalsyrf](https://github.com/akmalsyrf) ([2ce342d](https://github.com/molikas/axoview/commit/2ce342dc98278ac73841fb083d51969da811f30e))
* Add labels to icons indicating if not isometric (flat) ([#201](https://github.com/molikas/axoview/issues/201)) ([a553e3c](https://github.com/molikas/axoview/commit/a553e3c00ce8a9e776ba700e8fbdfc304c3e953e))
* add language detector & update Chinese README ([#127](https://github.com/molikas/axoview/issues/127)) ([e18e51f](https://github.com/molikas/axoview/commit/e18e51fb7fc4d5f5959c2f2e5cb31d20ee2c1b6a))
* add LLM-friendly export features and format code with Prettier ([77b304c](https://github.com/molikas/axoview/commit/77b304c98a53cdf753172c48507ef29f4503a00f))
* Add option to toggle connector arrows ([dea6a1e](https://github.com/molikas/axoview/commit/dea6a1e934857480dcf4dbb35801a176d182d4f9)), closes [#74](https://github.com/molikas/axoview/issues/74)
* Add server-side storage for persistent diagram management ([bf3a30f](https://github.com/molikas/axoview/commit/bf3a30fa129932dd0c3d01ca97ed30e579c8e418)), closes [#48](https://github.com/molikas/axoview/issues/48)
* added error boundary ([#90](https://github.com/molikas/axoview/issues/90)) ([179b512](https://github.com/molikas/axoview/commit/179b512c7d1e17f9aab18db05e12017399890497))
* added in esc to get ya out of menus/interactions/connectors Fixes [#154](https://github.com/molikas/axoview/issues/154) ([5cf61c3](https://github.com/molikas/axoview/commit/5cf61c3055c9ef1ad6a2cf5b67659e3a825a28fa))
* Added Portugues, French, Hindi, Bengali, and Russian support -Stan ([b299bc3](https://github.com/molikas/axoview/commit/b299bc33018b47708d546a43c80ee46629be818f))
* Added Spanish support! added more I18n compatability -Stan ([be14d87](https://github.com/molikas/axoview/commit/be14d8705319da406a1cad142731ee0a698bcd3c))
* Added SVG export, fixes [#211](https://github.com/molikas/axoview/issues/211) ([b14832f](https://github.com/molikas/axoview/commit/b14832f541068d41f88379a8c907648549f433b6))
* adds ability to remove a node ([2e2a98f](https://github.com/molikas/axoview/commit/2e2a98f5e99633c51d9df19b8f16ecc394c9ab1a))
* adds basic editor example ([dc04314](https://github.com/molikas/axoview/commit/dc04314f46892b1c11bb9c841e7ac31ed97b88e7))
* adds codesandbox config ([b23c3a9](https://github.com/molikas/axoview/commit/b23c3a9593705f03ba26cfe9d7ea87baea3ae2a9))
* adds deleteView reducer ([80f257b](https://github.com/molikas/axoview/commit/80f257b016987b9e873af76613b42d5785481d16))
* adds discord option to main menu ([86900a9](https://github.com/molikas/axoview/commit/86900a97801dd6a1885f6f99c32febc653b5efce))
* adds documentation ([a279729](https://github.com/molikas/axoview/commit/a279729dc6bc319daf1ae84d571d9742302c08ec))
* adds example for readonly mode ([db1fc8f](https://github.com/molikas/axoview/commit/db1fc8fb36d59cf63b0fdfed47edffd944d13bee))
* adds icons ([b7ac563](https://github.com/molikas/axoview/commit/b7ac56337d0b429275be60d31d25f6a13b3d9775))
* adds image export options to toggle grid and change bg color ([ee7a92d](https://github.com/molikas/axoview/commit/ee7a92d1f39d141fc710e92071cc8a13c83e53da))
* adds link to Github repo in main menu ([109048c](https://github.com/molikas/axoview/commit/109048c8d2c5398285977c6afb94d465bdd0888c))
* adds linting dependency ([bfb0295](https://github.com/molikas/axoview/commit/bfb029584d3caa0d76acafae6d369e5d02e3f55f))
* adds standalone build and a Dockerfile ([e8d678d](https://github.com/molikas/axoview/commit/e8d678d191c60a9dfb96e05f099d509eee7ea4a9))
* adds title to scene config ([ee3306b](https://github.com/molikas/axoview/commit/ee3306b6914e9f7b39915cb96b76530569fa2db2))
* adds to standaloneExports ([d5084e2](https://github.com/molikas/axoview/commit/d5084e28ea2a5abf02d019d21621a7ec6824bf91))
* adds utility methods on the window for debugging ([38c4278](https://github.com/molikas/axoview/commit/38c4278e16c639e547aac626314f9adba8d96dc3))
* adds validation check for connectors with less than 2 anchors ([880ed5b](https://github.com/molikas/axoview/commit/880ed5bea740bf39bdecaaaa560c59e2a8937a6b))
* adds zoom on scroll ([53641a4](https://github.com/molikas/axoview/commit/53641a4a86bcec582ff4c26f899799b9f721ecc8))
* allows all interactions to be disabled ([0e5ca5a](https://github.com/molikas/axoview/commit/0e5ca5a442eab1f83e0a754b0c1bd1d3c25479f3))
* allows an optional `viewId` to be passed as part of initialData ([30cd3f2](https://github.com/molikas/axoview/commit/30cd3f28f2f0315ae9c85ebfde18709c2bd36be2))
* allows better drag and drop interaction for connector anchors ([7661bcb](https://github.com/molikas/axoview/commit/7661bcb0693e6a9d3212f402b0ec297f54cb6bed))
* allows codesandbox to open a browser preview ([fbf48d2](https://github.com/molikas/axoview/commit/fbf48d26cadf502dcf0bbcb3bf696a8063103129))
* allows color selection for nodes ([39afd84](https://github.com/molikas/axoview/commit/39afd84553c5da8a1d36c0560e9b792e74277d8f))
* allows custom node labels (with example) ([55f9b37](https://github.com/molikas/axoview/commit/55f9b37c5623127c57a47c716679cb8ed31169c2))
* allows expandable node labels ([90f6c0e](https://github.com/molikas/axoview/commit/90f6c0ed860eaff307e2c6fafefb9663ec39c864))
* allows icons to be drag and dropped onto canvas ([07dc1d1](https://github.com/molikas/axoview/commit/07dc1d163ccf39437ea02a18f2d33d7c2542fde8))
* allows layer order of rectangles to be changed ([56591cb](https://github.com/molikas/axoview/commit/56591cb10296f05727af31ead306570031d6c787))
* allows loading of local scene file ([8b362ea](https://github.com/molikas/axoview/commit/8b362ea022dfe85f10b34c7eb55b42052f447795))
* allows main menu to be customised ([46ce637](https://github.com/molikas/axoview/commit/46ce637cd0be6ce9563c22328f5ba34a3f99fc1a))
* allows main menu to be hidden ([3b02ae1](https://github.com/molikas/axoview/commit/3b02ae1f226f304d2f89ed1cc66d71d01ddd10eb))
* allows node icon to be changed ([fd88787](https://github.com/molikas/axoview/commit/fd88787eb1fa6a0e52853bb84ddc29adf1480e19))
* allows node labels to be expanded ([a1783f1](https://github.com/molikas/axoview/commit/a1783f180b4533a827f78d6b3ff2bff89704fb4f))
* allows project to be centered ([c638bf0](https://github.com/molikas/axoview/commit/c638bf015cad7d35a7fbd2b24e08cf5ad796c8a7))
* allows saving of scene ([a1a98f2](https://github.com/molikas/axoview/commit/a1a98f288be5383f5acb6f954b47c07bd04d9f44))
* allows textBoxes to be dragged from any point ([2f6cfa1](https://github.com/molikas/axoview/commit/2f6cfa127462e5a70723fb79b499433e23ede8bc))
* allows translation of rectangles ([19478ab](https://github.com/molikas/axoview/commit/19478abb78570232d42b3ec877c02a6d971bac68))
* allows width and height to be passed through as props ([f1f9c0f](https://github.com/molikas/axoview/commit/f1f9c0f92b91ec1338e77bc2fa0488dbcde2e100))
* applies animation on zoom and scroll ([efde778](https://github.com/molikas/axoview/commit/efde7780a025f90c8df08659673f6f8d626b1b16))
* attempts to boost performance by explicitly activating GPU rendering ([0dc27b7](https://github.com/molikas/axoview/commit/0dc27b7be464c0bd1d64896ef86b7c4436da3b5f))
* audit findings — ESM output, type safety, test coverage, bug fixes ([9131e74](https://github.com/molikas/axoview/commit/9131e749ad3a595d774efe8f09d90901815896bf))
* blocks pointer-events on title ([b5a57d0](https://github.com/molikas/axoview/commit/b5a57d067f6933b328f33e115cf573ebf2e245f8))
* **brand:** icon set + toolbar-left brand mark; cut 2026.5.21 ([5056abe](https://github.com/molikas/axoview/commit/5056abe67e631f3a973b72d6c6f26943134282ce)), closes [#1f2937](https://github.com/molikas/axoview/issues/1f2937) [#2563eb](https://github.com/molikas/axoview/issues/2563eb)
* bumps patch version ([94c3097](https://github.com/molikas/axoview/commit/94c3097f39bbadef382b3bbb82c0476a871b5280))
* bumps up isopacks version ([2a9d10b](https://github.com/molikas/axoview/commit/2a9d10bf9bebe555828275368f9fc2ad01c392d0))
* changes starting mode to PAN ([5f015c4](https://github.com/molikas/axoview/commit/5f015c45399a3e771ad9632464e2aac5102b61a1))
* **ci:** added auto ver updating in the main menu ([b1ae328](https://github.com/molikas/axoview/commit/b1ae32804920088f47dca3b23f13bc5590773380))
* **ci:** added selenium based testing procedure for integration tests ([af6dabe](https://github.com/molikas/axoview/commit/af6dabe0fd43eb899ea0d4078ba4eb0ec195bc1d))
* **ci:** fixing ci stuff ([85fa0e6](https://github.com/molikas/axoview/commit/85fa0e668129577f7ab6427946b0e6c5b2c1bccb))
* **ci:** implemented automatic versioning plus releases ([9d9fe84](https://github.com/molikas/axoview/commit/9d9fe84eefa6a3a6b2ec158910956debb059bbc2))
* closes any open itemControls when panning mode selected ([aba2633](https://github.com/molikas/axoview/commit/aba2633abb61fa40f2bbc18ef4a821fd0579efa7))
* closes any open itm controls if main menu is opened ([a21d01b](https://github.com/molikas/axoview/commit/a21d01bfe35da5f4097c65af36853678e83af347))
* closes main menu BEFORE native file dialog appears ([1382c41](https://github.com/molikas/axoview/commit/1382c4165dd61980083ad64822a19e693fd8da74))
* configures webpack build for docker image ([1a64706](https://github.com/molikas/axoview/commit/1a647062d15addb0fe2abb2f6ec623d16db0a41c))
* connector anchor reconnect UX + glass-morphism handles ([da06e53](https://github.com/molikas/axoview/commit/da06e537fcbf8218dd372ae432d3650ee82345f2)), closes [#a5b8f3](https://github.com/molikas/axoview/issues/a5b8f3)
* connector parity, details panel polish, UX consistency pass ([7ee1f31](https://github.com/molikas/axoview/commit/7ee1f312880c156681943e294e3256d018f8b767))
* connector single-shot, Rectangle rename, ToolMenu cleanup, flat icon elevation fix, docs overhaul ([41d6748](https://github.com/molikas/axoview/commit/41d6748c4c3c1fea7b28249297cc27b26ab33b45))
* connector/node/textbox label colours, rich text boxes, auto-height ([ed1721f](https://github.com/molikas/axoview/commit/ed1721fb71f5072be3140fc97adb8380d975b049))
* copy/paste, lasso hint auto-dismiss, and node label fixes ([d122433](https://github.com/molikas/axoview/commit/d1224338dc03bcd4b7e4787699bb5f6a51422cd3))
* debug mode size indicator now wraps around all items ([536b51d](https://github.com/molikas/axoview/commit/536b51dc29f6eb727919b54d92f7739f361aaa54))
* default zoom 85% + condense 2026-04-07 README entry ([bee6ba8](https://github.com/molikas/axoview/commit/bee6ba8e3379b710604f6784018d31129203da57))
* default zoom 90%, transient right-click pan with deselect ([d1ed850](https://github.com/molikas/axoview/commit/d1ed850bbc6336796bc15bdb8e459c9088c4cdab))
* disables lasso mode for now ([d017b3e](https://github.com/molikas/axoview/commit/d017b3eaa8f3efdf61ac37c095cc3f75c6330ef7))
* disables scroll / zoom animations on drag and drop layer ([1d9324e](https://github.com/molikas/axoview/commit/1d9324eb84cf7c28bf9268529324651d75490cc9))
* displays connector anchors only when connector is selected / active ([366b816](https://github.com/molikas/axoview/commit/366b816521ac15aa827207441feca21f1b93195b))
* displays main manu in top left corner ([6bbef04](https://github.com/molikas/axoview/commit/6bbef041df4658df2f1dad85192069e316aa5e01))
* displays title at bottom of view ([35b73de](https://github.com/molikas/axoview/commit/35b73defe74b57175f0ab047b454b8b8530cc23d))
* **docker:** add HTTP Basic Authentication support ([#214](https://github.com/molikas/axoview/issues/214)) ([ac77038](https://github.com/molikas/axoview/commit/ac770382e868b9c163ed0bf0481dbfb3f15c40b8))
* enable panning by dragging on empty space with left mouse button ([ddb28a2](https://github.com/molikas/axoview/commit/ddb28a2eda31b3777d73593ad46f59c91d7c23ed))
* enables dragging of connector anchors ([f808159](https://github.com/molikas/axoview/commit/f80815976dc31db1207f466f222dcc0c75da5b75))
* enables expandable labels on nodes ([36c5c17](https://github.com/molikas/axoview/commit/36c5c179d59c21f94076647f4b8ce8a00d9e0398))
* enhance connector functionality with multiple labels and line types ([#128](https://github.com/molikas/axoview/issues/128)) ([d5e02ea](https://github.com/molikas/axoview/commit/d5e02ea30346fbc2528dc0337792ebccf309d94d)), closes [#107](https://github.com/molikas/axoview/issues/107) [#113](https://github.com/molikas/axoview/issues/113)
* enhance context menu functionality with item and empty states ([674b46f](https://github.com/molikas/axoview/commit/674b46f6047ba837bee950d2eeceecbeaae06b00))
* ensures connectors have start and end nodes ([0bace0b](https://github.com/molikas/axoview/commit/0bace0bc5f0e331e2302dbc1c4eb3b66e4e2c6db))
* executes entry / exit logic for interactions ([3112842](https://github.com/molikas/axoview/commit/311284217491fb099325514f991d283bea816cdb))
* exports isoflow props as type ([75ed461](https://github.com/molikas/axoview/commit/75ed46180f714e2b110e9f52acc3464f2126e995))
* exports Scene typings ([28122ed](https://github.com/molikas/axoview/commit/28122ed6b7ab8f765f1371ed140f6b2aba122d83))
* exports types ([28f4db9](https://github.com/molikas/axoview/commit/28f4db99b97ca790c6bb0c45b8219a2018aeffd5))
* exposes api to update single node and hook into scene changes ([37fd9ea](https://github.com/molikas/axoview/commit/37fd9ea16c02e8604ab8eaa4461062d4c7b46280))
* **fileExplorer:** split per-diagram export into image / JSON actions ([9e3055f](https://github.com/molikas/axoview/commit/9e3055f80787dd55faf78e07f58e1a0af7c85d8a))
* filters textbox data on scene export ([ca087b4](https://github.com/molikas/axoview/commit/ca087b4322e6404d0b76ff85a3e4dfeb8fa930db))
* fixes cursor position when editor not 100% of viewport ([287de5b](https://github.com/molikas/axoview/commit/287de5bd0ea2e2f4a03dc831642045e324060e00))
* fixes UX around drag and drop onto canvas ([37bc36c](https://github.com/molikas/axoview/commit/37bc36c563735e31befa28b63bf6da9aee33dc9a))
* fixes zIndexing of scene items ([516ab8b](https://github.com/molikas/axoview/commit/516ab8b63347c9df1a7de56259ae1951740b3bdc))
* full i18n coverage + export image blank preview fix ([ee3fac4](https://github.com/molikas/axoview/commit/ee3fac49ab45c8b01b33e3277747e9ccd9595e9c))
* grid listens to window resize events ([0b97897](https://github.com/molikas/axoview/commit/0b9789746a2f31d933b6011706b7b8cbcb4a855d))
* **help:** update help dialog to reflect new interaction controls ([1248e7e](https://github.com/molikas/axoview/commit/1248e7ebc300c94e45aee345ae7a9d2c72e4e14e))
* hides label height control when no label present ([82977bf](https://github.com/molikas/axoview/commit/82977bfa26d4e9d747c4ff9e740c8f744fb62fd8))
* hides scene title if editor is in 'NON_INTERACTIVE' mode ([91fa85a](https://github.com/molikas/axoview/commit/91fa85a1c5cfd7ef2fd68917c8ce1f6eb8cd5b79))
* imperative diagram loading, multi-view management, and diagram/view renaming ([c965b1c](https://github.com/molikas/axoview/commit/c965b1cb1314153791cfb70c8d24483205087e6c))
* implement comprehensive undo/redo system with keyboard shortcuts and UI integration ([b9356d3](https://github.com/molikas/axoview/commit/b9356d3c76ce72cf1f88778b6814f1e543b23433))
* Implement quick icon selection workflow for improved UX ([8576e30](https://github.com/molikas/axoview/commit/8576e300ece9d79a7817c814e5a1f1baa46f7457)), closes [#56](https://github.com/molikas/axoview/issues/56)
* implements 'clear canvas' menu item ([e65a782](https://github.com/molikas/axoview/commit/e65a782feb640dba00d61a3a2a46a5dec6c3393f))
* implements adding node to scene ([99c8060](https://github.com/molikas/axoview/commit/99c80602437fea802f6975d3132d93e7ec8c35b6))
* implements basic support for touch devices ([a841504](https://github.com/molikas/axoview/commit/a8415041542709ea089817790cc4db920349ccb4))
* implements callback example ([57f6a00](https://github.com/molikas/axoview/commit/57f6a0059b84cc5ec8ce8945972f6a17132becc8))
* implements connector colors ([eef4dba](https://github.com/molikas/axoview/commit/eef4dba7901b2603ebb8342ed66d8c19967eebf1))
* implements connector controls ([198a1f4](https://github.com/molikas/axoview/commit/198a1f4e2dc5a6a0a0fe21a53d719de5fde6eaff))
* implements connector direction icon ([eeaaad9](https://github.com/molikas/axoview/commit/eeaaad93c5ff8f63305726aa7f5d2363208eea25))
* implements connector labels ([4ad8b22](https://github.com/molikas/axoview/commit/4ad8b22482b0dcb9e1821fe59ac495ff1bc8dc9d))
* implements connector logic ([19324be](https://github.com/molikas/axoview/commit/19324bed91d55136f21e962002d6774589f6e6f2))
* implements connector styles ([46de2cf](https://github.com/molikas/axoview/commit/46de2cf19afdf23bcefa5dbb7cfcb70f4cedf784))
* implements connector width controls ([58dd3b5](https://github.com/molikas/axoview/commit/58dd3b59da92c2010f501e19df56d462a632aba1))
* implements connectors ([43aab47](https://github.com/molikas/axoview/commit/43aab4758ef37f6b50b0e64016f19e52e17fa5bc))
* implements group rendering (UI not implemented yet) ([d9daa68](https://github.com/molikas/axoview/commit/d9daa68b0dcd6c6433096dc5ca33041fd1a347aa))
* implements icons searchbox ([887a916](https://github.com/molikas/axoview/commit/887a91607c2a2a84dbfe11ea4e536768d290890a))
* implements image export ([9f11cce](https://github.com/molikas/axoview/commit/9f11cce6e0ba2f0beefad06140768ae9c9ef6763))
* implements lasso selection (UI disabled) ([a76e5e7](https://github.com/molikas/axoview/commit/a76e5e72899010a83f73d43d0e465dc18cd9d4f4))
* implements lastUpdated field on views ([3cff06d](https://github.com/molikas/axoview/commit/3cff06dc5e93464b22e74de3364166ff0e255f11))
* implements multiselect ([f68daac](https://github.com/molikas/axoview/commit/f68daacc2973aa5757075a69326aa71f191bf6a5))
* implements node delete ([b13cd66](https://github.com/molikas/axoview/commit/b13cd66706b997b2ea290ea3a6a46fc046a6e493))
* implements node drag and drop ([b350320](https://github.com/molikas/axoview/commit/b35032038706641989f03611a74c7137fefe2e7c))
* implements node labels ([f93f901](https://github.com/molikas/axoview/commit/f93f901521ebf391984181456fcf09513aecd56d))
* implements node positioning via drag and drop ([a6fdbf0](https://github.com/molikas/axoview/commit/a6fdbf0c007750721184218b3bce34a50fddb9f8))
* implements onSceneUpdated callback ([f1f77d4](https://github.com/molikas/axoview/commit/f1f77d4ecab525a1f5e7f08efdf51dd905d1b824))
* implements readmore on node description overflow ([f9536c9](https://github.com/molikas/axoview/commit/f9536c9cb706ff66cab91b0b3814ea2cc75e9af2))
* implements rectangle controls ([94995f0](https://github.com/molikas/axoview/commit/94995f099c3a3105b1a88f1629b589532e2aa858))
* implements rectangle delete ([416b976](https://github.com/molikas/axoview/commit/416b9765b797fa599ee0afabd6700c8497d6bbc7))
* implements rectangle tool basics ([bd7a118](https://github.com/molikas/axoview/commit/bd7a11849cba439f825b31d23484fd0b3aeb81c8))
* implements text tool ([c240def](https://github.com/molikas/axoview/commit/c240def317422521280b5264e2b2797472074f02))
* implements transform controls for rectangles ([cb36408](https://github.com/molikas/axoview/commit/cb3640817358f5543fc6fc24bb36fd44f3dcd50f))
* imports isopacks as separate package ([0580440](https://github.com/molikas/axoview/commit/0580440b28c42d6e70c792c9090f7a877c37413e))
* improves label handeling ([1d3e7d5](https://github.com/molikas/axoview/commit/1d3e7d51836f2d33f9876c40b202634154eab307))
* improves mouse tracking ([77e8c02](https://github.com/molikas/axoview/commit/77e8c02c736f4d299121691f173dcecf2895c963))
* improves panning mode UX ([2230637](https://github.com/molikas/axoview/commit/2230637a529dd1717fcac0f9dfe9622252959cb2))
* improves panning mode UX ([4b0d3d8](https://github.com/molikas/axoview/commit/4b0d3d86e9d2cc4b6ecba65072c2b9b461918ed3))
* improves scrolling on sidebars ([6c76790](https://github.com/molikas/axoview/commit/6c76790800edb7493ab68d71ad35d0bbf886cb6d))
* improves textbox sizing ([20ac174](https://github.com/molikas/axoview/commit/20ac1747044c956946f7d3aec60cd12da6a37491))
* improves UX on Tool menu ([ac4e9e8](https://github.com/molikas/axoview/commit/ac4e9e8563092e0285c557a7d3ca03bbca634c06))
* improves UX when dragging rectangle anchor ([5feca66](https://github.com/molikas/axoview/commit/5feca66326abda286bfe8b97cc6c48226bea31bf))
* improves UX when selecting elements ([541e469](https://github.com/molikas/axoview/commit/541e46969740ea9f8d31002c3c80af2f466c5f4e))
* improves word wrap handling in labels ([ba30ffd](https://github.com/molikas/axoview/commit/ba30ffd0320bde7364b3b5e93d4bafd4aff5674d))
* increases resolution of export images ([68c11e5](https://github.com/molikas/axoview/commit/68c11e5a1d8267f232e1bab917a8ae12c7b58b2a))
* installs zustand devtools ([ad78b52](https://github.com/molikas/axoview/commit/ad78b524b5687cae2f789873707832d33411fb65))
* introduces new TextBox tool ([23d3bda](https://github.com/molikas/axoview/commit/23d3bdaae009e402199e163f7287adae4a4289cf))
* isoflow takes 100% height as default ([85e36bd](https://github.com/molikas/axoview/commit/85e36bd876fdda4a10ab44e288d62a6ee1586ea2))
* keeps icons when canvas is cleared ([ccbedd7](https://github.com/molikas/axoview/commit/ccbedd7c98b4c15f7cb30bcff4ef3e74fcdb9002))
* layout revamp — toolbar + left/bottom dock contract (ADR 0005) ([e0cc322](https://github.com/molikas/axoview/commit/e0cc32257e1200514e09073a80740b8b6415949c))
* left dock + bottom dock + icon grid overhaul ([05edf43](https://github.com/molikas/axoview/commit/05edf43008e9b0d9499f36c75106d2a2753a57f4))
* limits connector width ([14a72c7](https://github.com/molikas/axoview/commit/14a72c7b2ef1f8356b47c7772bafb58936461f6e))
* Lots of language support! ([956a2af](https://github.com/molikas/axoview/commit/956a2af52f534be02b7d417f413a0ee66dd2e17d))
* makes App component default export ([8d731af](https://github.com/molikas/axoview/commit/8d731afc44c324a7fc76c51dbd6b6a65f4c1ecc9))
* moves non-interactive check further up the tree ([7a1ab19](https://github.com/molikas/axoview/commit/7a1ab1973aec11b65a93c65936b3a5420b303818))
* moves zoom controls to lower left ([c2f456a](https://github.com/molikas/axoview/commit/c2f456a496710a7a288a04c32e3386218741bcf8))
* MQA Bundle A — 8 fixes + page cap + docs sync (2026-05-15) ([a85dbc8](https://github.com/molikas/axoview/commit/a85dbc89bb5e50fc93c14e835cc8bf90f8c72cb0)), closes [#1](https://github.com/molikas/axoview/issues/1) [#2](https://github.com/molikas/axoview/issues/2) [#3](https://github.com/molikas/axoview/issues/3) [#15](https://github.com/molikas/axoview/issues/15) [#4](https://github.com/molikas/axoview/issues/4) [#6](https://github.com/molikas/axoview/issues/6) [#23](https://github.com/molikas/axoview/issues/23) [#27](https://github.com/molikas/axoview/issues/27) [#28](https://github.com/molikas/axoview/issues/28)
* New Diagram, unsaved-changes guard, import icon dialog cleanup ([016326d](https://github.com/molikas/axoview/commit/016326d481dac4d80c9883b4584fd3572ca3b326))
* node panel tabs (Details/Style/Notes), action bar, quick-add, aria fixes ([5f2a864](https://github.com/molikas/axoview/commit/5f2a8644e6fc75018c2901a01e3a7c92f1bdc583))
* performance upgrade (solves issue with nodes not being GC'd) ([bf42411](https://github.com/molikas/axoview/commit/bf42411d5ef055f253b9c8f4f80b321137b2a9f5))
* Phase 0B + 1A — Notification system and 2D canvas mode ([a0ee8a4](https://github.com/molikas/axoview/commit/a0ee8a48b05bfecc27e5bacf6c2619130fa21056))
* Phase 1B — Material Icons pack + 6 bug fixes ([136faeb](https://github.com/molikas/axoview/commit/136faeb52a6fc241a9f7f75ac7058e636b339ded))
* Phase 2A — Pluggable storage interface (local provider) ([ed17558](https://github.com/molikas/axoview/commit/ed175582cfeb0fd5a8a28d09ecba0b01b74b39c1))
* Phase 2B + 2B-R — File explorer, empty state, dialog polish ([e039e1f](https://github.com/molikas/axoview/commit/e039e1f64a31e264393bf3e8e1e59f5ccc05e692))
* Phase 2C — Diagram-to-diagram links, UI polish, welcome popup on empty state ([158864a](https://github.com/molikas/axoview/commit/158864af54790f4b7083643805b1472b139cf3db))
* Phase 5* — Cloudflare + Docker dual-target deployment ([fc8f37e](https://github.com/molikas/axoview/commit/fc8f37eecc578b27a9a22df6832b0435e28a1518))
* prevents onSceneUpdated called the first time scene is loaded ([d1bc30e](https://github.com/molikas/axoview/commit/d1bc30e8d8476f03708d71c8703e655de487193d))
* prevents user highlighting while dragging ([7a5b996](https://github.com/molikas/axoview/commit/7a5b99668b2b4cfcc95aa0092920344d41305f85))
* preview button, view-only single-scroll panel, smart node clickability ([a8f7493](https://github.com/molikas/axoview/commit/a8f749318ad40f5f6fc8f5800d4f7323db75c8b2))
* read-only mode ([#168](https://github.com/molikas/axoview/issues/168)) ([85d32e6](https://github.com/molikas/axoview/commit/85d32e64df0f4d22bd7c2d6b3a51275c09813f72))
* reduces height of node labels ([d551897](https://github.com/molikas/axoview/commit/d551897bdabd1b5727810e645cc6543ba441b702))
* reduces size of icons slightly ([32f4b12](https://github.com/molikas/axoview/commit/32f4b129b99e9433ebd073c9f3ba793a67ddcf57))
* refactors schema to accomodate model ([ad5a4e0](https://github.com/molikas/axoview/commit/ad5a4e06f38f3da7bb5c8cb50da7ccd50991a722))
* reinstates interactions ([97d65fa](https://github.com/molikas/axoview/commit/97d65fabf40f0ea7d9311083468f90c8af3d22e5))
* removes buggy scrollTo node when label expanded ([b0c5c9d](https://github.com/molikas/axoview/commit/b0c5c9d4c3d832a8dc9d1dd3ba052c52f3321653))
* removes color from node schema ([ccea412](https://github.com/molikas/axoview/commit/ccea412b8d07f67efc28b5f4db2aecc7e86233b3))
* removes custom label container for now ([194b4ed](https://github.com/molikas/axoview/commit/194b4eda2d64ca9653e407d3d5c8b1f14fceb653))
* removes zustand dev tools ([4a4f168](https://github.com/molikas/axoview/commit/4a4f168671d7aef944e3c91dfdd3661305dbef96))
* rename Group, fix double-click UX, tests, docs ([77e0b49](https://github.com/molikas/axoview/commit/77e0b49460a531ad8577368d8589caa43095fb4c))
* **rename:** backwards-compat migration for localStorage + ZIP + debug global ([8eca564](https://github.com/molikas/axoview/commit/8eca564ff15d2958c147b0314ea8792ba90a35ff))
* renders a basic node to scene ([5dbeb97](https://github.com/molikas/axoview/commit/5dbeb973b05c2e3874cd7d137ed29aa877dd6f73))
* replace import toolbar with tooltip guidance ([a2a47b4](https://github.com/molikas/axoview/commit/a2a47b44496f4982c43fe7f9dd9915f281160169)), closes [#123](https://github.com/molikas/axoview/issues/123)
* replaces xstate with custom state machine implementation ([6b90ad9](https://github.com/molikas/axoview/commit/6b90ad9b7b8aedd19a8ed0175eb537fde3656657))
* resets the UI after a canvas clear ([413567e](https://github.com/molikas/axoview/commit/413567efd39d2b30c97f22f283a39868641d9760))
* resets view after file has been successfully loaded ([9910fec](https://github.com/molikas/axoview/commit/9910fecadabb767655ee1c3693e91c754fa728ac))
* resets window cursor when Isoflow is unmounted ([5d51aab](https://github.com/molikas/axoview/commit/5d51aab7224e7b79f7b1cd6c85768809a28f6bbe))
* right-click toggles pan tool, left-click exits back to select ([dbf82d2](https://github.com/molikas/axoview/commit/dbf82d2f0c84b4c3b6ef7e56ce91b9d71d41a2e4))
* Save & Preview, help dialog, docs consolidation ([727d673](https://github.com/molikas/axoview/commit/727d67365241d83852c51dec5cb2930a482345b6))
* save status label with context-aware date and save toast ([b090fea](https://github.com/molikas/axoview/commit/b090fea5ac1c36405465a18674218765ef812329))
* session-mode UX revamp + canvas/tree inline rename polish ([5f6a70e](https://github.com/molikas/axoview/commit/5f6a70e9ec47be5e7224d6e89dd338506602dbd6))
* sets min width on node labels ([620970e](https://github.com/molikas/axoview/commit/620970e99d29783dddf90e1c9e6a02d210d8fb65))
* sets overflow hidden ([9614b5e](https://github.com/molikas/axoview/commit/9614b5ef5dfb30418e138d60bc01aa0a590c5f18))
* shows animated outline around focussed nodes ([53bd3f2](https://github.com/molikas/axoview/commit/53bd3f2c2f8d1bf29f58f5ace0a6e7b378f0449c))
* shows both model title and view title at bottom of screen ([159f6d4](https://github.com/molikas/axoview/commit/159f6d4c75c9c5225b1fa0ae51cf4b89706c0947))
* sidebar panels, unified toolbar, layer UX improvements ([b8b72e4](https://github.com/molikas/axoview/commit/b8b72e43db89387b4fd86ef41e50b03865d4b8f6))
* stores colors as part of model ([4797b22](https://github.com/molikas/axoview/commit/4797b223047ae7eccbb7be8db1b1028e99e2d501))
* styling updates ([9270924](https://github.com/molikas/axoview/commit/927092475634cd38877367fa30f268e3d411fcb0))
* styling updates on all ui elements ([4de4882](https://github.com/molikas/axoview/commit/4de4882b03685e27c84e50714b446a67d45fb2e6))
* toolbar/UX overhaul — Save/Load/Share, right-side panel, view switcher in readonly ([50d17b4](https://github.com/molikas/axoview/commit/50d17b48f27d63f6aa43684dbe9d65e6a1380ca1))
* transparent background for exporting as png ([#180](https://github.com/molikas/axoview/issues/180)) @F4tal1t thank you for contributing as always! ([ba1b376](https://github.com/molikas/axoview/commit/ba1b3762db9ac34360703553e5428cf39f556534))
* typography contract + UX consistency pass — 2026-05 shake-out wrap ([4875541](https://github.com/molikas/axoview/commit/48755414bee9ddd7edf304781e5c553cc178a450))
* **ui:** enhance custom color picker and fix docs ([#169](https://github.com/molikas/axoview/issues/169)) thank you [@non-stop-dev](https://github.com/non-stop-dev) ([f56812c](https://github.com/molikas/axoview/commit/f56812c24e1d2eb402fce990d3607155d9f94014))
* updates 'read more' button styling ([cfb60f3](https://github.com/molikas/axoview/commit/cfb60f37cf088ffd108bfb77f742c8810f280ec0))
* updates anchor connector schema ([5d6f3d0](https://github.com/molikas/axoview/commit/5d6f3d0aaf02e0a379102380d081748cefb7aa10))
* updates connector styling ([d980947](https://github.com/molikas/axoview/commit/d980947e86d27a73ea4da67a9bb1203df8f3debb))
* updates connector styling ([e21ed39](https://github.com/molikas/axoview/commit/e21ed39c782f0cc2ef66a8ae16d97daa5e398605))
* updates connector width defaults ([af5c060](https://github.com/molikas/axoview/commit/af5c06090036ea880d810f2cb6555e3e70288a7f))
* updates connector width to more sensible values ([851ae21](https://github.com/molikas/axoview/commit/851ae21283d547a14c04cca4538b6759bf92c0da))
* updates copy ([ffef690](https://github.com/molikas/axoview/commit/ffef6902eef7588bd5247bd4e6ea02f0ed7de174))
* updates copy on tooltip ([d127150](https://github.com/molikas/axoview/commit/d127150dd0cf8c76f98b7aab127c59931b9f5995))
* updates cursor styling ([73d9b52](https://github.com/molikas/axoview/commit/73d9b522eca44c6400c698204d663c9a05abacb1))
* updates docs ([485dc4c](https://github.com/molikas/axoview/commit/485dc4c021894372a23a80f45f108545bf9a718c))
* updates documentation ([1de5c9d](https://github.com/molikas/axoview/commit/1de5c9d8b50c32c20d2ec24a337b47b6795b536c))
* updates documentation ([52e1fc2](https://github.com/molikas/axoview/commit/52e1fc2802a4d8638a21cbda9cdd9e9b5406cb14))
* updates drag and drop instruction copy ([6cdff05](https://github.com/molikas/axoview/commit/6cdff059fe0f3af1b6da5b6cc93cba4d012041b9))
* updates example ([d707b14](https://github.com/molikas/axoview/commit/d707b14743648440343dd4302ac8566ef5b8a4ce))
* updates example content ([cbdcc76](https://github.com/molikas/axoview/commit/cbdcc767d40735498e8e1c5b9f838b11695a051d))
* updates example data ([1c28a47](https://github.com/molikas/axoview/commit/1c28a478803f7eba46c63cc8e9e9f03583ea9627))
* updates example data ([945ec81](https://github.com/molikas/axoview/commit/945ec811546423dc49a5d0066dec06779a16c7f8))
* updates example data ([edf6f28](https://github.com/molikas/axoview/commit/edf6f28b9e61970aa7db3150a3f35601792df9d1))
* updates example scene ([1c6af28](https://github.com/molikas/axoview/commit/1c6af28ca8d84ac6bc080bb6102a944acab4e5fb))
* updates example scene ([f9cc014](https://github.com/molikas/axoview/commit/f9cc014dc7e3d529e520f26f381c1040dc585dc8))
* updates examples and documentation ([4da997f](https://github.com/molikas/axoview/commit/4da997f3f38091be51927f3d8d7a26979d47f744))
* updates examples to start with fitToView=true ([a129c17](https://github.com/molikas/axoview/commit/a129c1715ada015500fd253e54d1d08a3481da6e))
* updates icon category styling ([1f67c29](https://github.com/molikas/axoview/commit/1f67c297fbff6497e3246d0273b3e6b8c1c4fd00))
* updates icons on zoom controls ([3de56fd](https://github.com/molikas/axoview/commit/3de56fdde8020fed98d1b790b33f1f6a5072781a))
* updates image urls in docs ([1e60907](https://github.com/molikas/axoview/commit/1e60907b4724585aa3199aa2868bce57a0b02602))
* updates main menu options ([031a90a](https://github.com/molikas/axoview/commit/031a90a78ac5b6057ce547a0041e96e88ad6e3a5))
* updates meta tag on example html page ([35850c4](https://github.com/molikas/axoview/commit/35850c44b1a1c9a7679af8adecb569b390787cd7))
* updates node connector styling ([78b243c](https://github.com/molikas/axoview/commit/78b243ca22ac221725e0e9a31d545ccc7905f930))
* updates palette ([a061f57](https://github.com/molikas/axoview/commit/a061f573040c29d7467588a54f03cc7938507b39))
* updates readme ([f5be45b](https://github.com/molikas/axoview/commit/f5be45bbefc12e99ae54aed3f0f6d4c84f0b21b2))
* updates rectangle styling ([e60e16e](https://github.com/molikas/axoview/commit/e60e16e469a422d06fc12ac49fcbec688fddf5c3))
* updates roadmap on README ([8992d84](https://github.com/molikas/axoview/commit/8992d84cc653f354b2fb7b0fa2e9c9702059d628))
* updates sidebar styling ([c83452b](https://github.com/molikas/axoview/commit/c83452b3cb1b9143377392da2f56f228e0fc004e))
* updates styling ([a69cbf8](https://github.com/molikas/axoview/commit/a69cbf804ccc9361559863bf1658b516ab2b0de4))
* updates styling ([fee7c2a](https://github.com/molikas/axoview/commit/fee7c2a244621c4c9db93bffcedf420f6ea5ebbb))
* updates styling ([52ec509](https://github.com/molikas/axoview/commit/52ec50913e8be175097ed2c40d4bdd91906518fa))
* updates styling on node labels ([d0f3cdf](https://github.com/molikas/axoview/commit/d0f3cdf791fc1e746921a2e49a2a38002d291532))
* updates theme colours ([1faeb31](https://github.com/molikas/axoview/commit/1faeb31d3e8e1efd756127d48fd824eb6b49ec1e))
* updates view default name ([4d4a668](https://github.com/molikas/axoview/commit/4d4a668950720c0ba81a357d19101508f3eb2b83))
* upgraded to ESlint 9, fixed some vulns ([4e2a2d1](https://github.com/molikas/axoview/commit/4e2a2d1a11925c960c88ff737069bc48d851c105))
* upgrades performance on debug tools ([2f9bc47](https://github.com/molikas/axoview/commit/2f9bc47eb59ddf791abd6da9a1589a78e768d98e))
* UX improvements — cursors, copy/paste, font size, TextBox formatting ([88ddbca](https://github.com/molikas/axoview/commit/88ddbcae7d5596ce17c92b8184ca3a65ef4b56d4))
* UX shake-out 2026-05 — bundles A+B+C (pre-typography pass) ([e7d25a0](https://github.com/molikas/axoview/commit/e7d25a0e4e11bcec25d924b9372af3814f5f43e7))
* **ux:** MQA [#10](https://github.com/molikas/axoview/issues/10) — auto-expand + soft pulse for newly loaded icon categories + release 2026.5.19 ([4a41982](https://github.com/molikas/axoview/commit/4a41982a70ff90e34b20ce056f9b2f138a6adcc5))
* **ux:** MQA [#11](https://github.com/molikas/axoview/issues/11) — canvas rich-text typography polish + 2D-Y rotation + release 2026.5.20 ([0b779dc](https://github.com/molikas/axoview/commit/0b779dcb33621d0951e8a44dce42e9758e32a906))
* **ux:** MQA [#19](https://github.com/molikas/axoview/issues/19) — tooltip-with-shortcut hints + dead-code cleanup ([b4ab2ef](https://github.com/molikas/axoview/commit/b4ab2efbbfd12633df89790b4a6853089248086a)), closes [8/#9](https://github.com/8/axoview/issues/9)
* **ux:** MQA [#20](https://github.com/molikas/axoview/issues/20) — Settings dialog left-rail redesign ([be99cd7](https://github.com/molikas/axoview/commit/be99cd781981089d4b201ddcf9658c685567d5aa))
* **ux:** MQA [#26](https://github.com/molikas/axoview/issues/26) — delete imported icons + tombstone fallback + release 2026.5.18 ([275fdfe](https://github.com/molikas/axoview/commit/275fdfefae53cfe0f5e1cb7e8d7d81feab5aae0d))
* **ux:** MQA [#8](https://github.com/molikas/axoview/issues/8)/[#9](https://github.com/molikas/axoview/issues/9) — multi-select contract + waypoint Alt+click ([d293f8f](https://github.com/molikas/axoview/commit/d293f8f55868c36987e67a011436a92f1e548c18))
* **ux:** startup splash + parallel storage probes + 800ms timeouts ([53e16a3](https://github.com/molikas/axoview/commit/53e16a3d82c0de91104fb48e00c2e260d4c84894)), closes [#ff-splash](https://github.com/molikas/axoview/issues/ff-splash)
* Variable DPI images! Finally! Fixes [#70](https://github.com/molikas/axoview/issues/70) you're welcome [@fatflyingpigs](https://github.com/fatflyingpigs) ;) ([88ab63c](https://github.com/molikas/axoview/commit/88ab63c969fd95538f369b8b5f0e4bba2b2e3b63))
* view layer system — visibility, lock, z-order, assign-to-layer UX ([f60d286](https://github.com/molikas/axoview/commit/f60d286ce4fa3ad0a884ce73a8594639ff2e41b7))

### Bug Fixes

* **2d-view:** align resize handles to rectangle corners in 2D mode ([a6a627b](https://github.com/molikas/axoview/commit/a6a627bc7a9074da094b5fb83ac0a6d4497ccee0))
* **2d-view:** render flat icons upright instead of iso-projected ([1927764](https://github.com/molikas/axoview/commit/1927764bc207207c85fda497523995a675ba2b7e))
* Add error boundary to handle React-Quill DOM manipulation errors ([6c38a11](https://github.com/molikas/axoview/commit/6c38a11f4b8fde448b18958cfb28cb6dd1862613))
* add missing i18n files to public folder for GitHub Pages ([606aebc](https://github.com/molikas/axoview/commit/606aebcf49ad3f269d19e155f4b68eef813724a8))
* Added lazy icon loading, users now select which icons they want loaded in, by default only the isoflow ones get loaded in, users can quickly change this, or disable this behaviour, this results in much faster loads. Fixes [#79](https://github.com/molikas/axoview/issues/79) ([e0462f6](https://github.com/molikas/axoview/commit/e0462f6bbd58543b98bfb395fca4fc6a10e62a50))
* adds keys to controls panel components ([c1c5bd3](https://github.com/molikas/axoview/commit/c1c5bd33fe13019b4a15f9bea75eaa1693846d1a))
* adds keys to mapped components ([6113819](https://github.com/molikas/axoview/commit/611381934fbe3bf2f39dd816099bb99a58bfde0d))
* adds tsc to linting script ([0e29ce3](https://github.com/molikas/axoview/commit/0e29ce31ef8a25576c5a0674328891a49cf6b7a1))
* **backend:** coerce non-array folders.json shapes (MQA [#21](https://github.com/molikas/axoview/issues/21) follow-up) ([5b34d8b](https://github.com/molikas/axoview/commit/5b34d8b139320feab75399a802bd8015a6346c23))
* bug on dragging items ([5c9e3e0](https://github.com/molikas/axoview/commit/5c9e3e0910ae0ffa444b3a2cb69a6f03332d049e))
* bug with disappearing item controls ([c3b72e3](https://github.com/molikas/axoview/commit/c3b72e3cfd08d5e4f97a2960fd07bcea912a749f))
* bug with dragging items ([1d0351c](https://github.com/molikas/axoview/commit/1d0351cc2d66b8dc288043ed96b0b4afde797cad))
* bug with moving rectangles ([e1515a7](https://github.com/molikas/axoview/commit/e1515a7409917516a0b2f89397c9a89060f43dd9))
* build error caused by missing property in src/i18n/es-ES.ts ([#202](https://github.com/molikas/axoview/issues/202)) ([574b298](https://github.com/molikas/axoview/commit/574b298e90a346d2cebd5c8b76a2bb2c80c25d6e))
* bumped all packages, no vulns in npm audit now ([09edf76](https://github.com/molikas/axoview/commit/09edf76ef12df55859b77fc74823f5425dbbf8b1))
* bumps @types/react down to v17 for compatibility ([9814af2](https://github.com/molikas/axoview/commit/9814af275666c35862fef97533e3e7a75f8baaad))
* calls function correctly ([f06acb6](https://github.com/molikas/axoview/commit/f06acb63753ad116d6b92d34574adf1603639fc5))
* **ci:** build fossflow lib before app in CF Pages ([8fa6b11](https://github.com/molikas/axoview/commit/8fa6b1187e21975360dcde89cfbfe853c10f7095))
* **ci:** bump .nvmrc to Node 20 for Cloudflare Pages build ([9de5108](https://github.com/molikas/axoview/commit/9de51089319ee86efaff64f8cb0937bb42eeb0ac))
* **ci:** force npm on Cloudflare Pages — drop stale yarn.lock ([f76ccce](https://github.com/molikas/axoview/commit/f76cccefeb861dfcb6cc96d54945bc725181e1c2))
* **ci:** only group and auto-merge minor/patch dependabot updates - stan ([3e91be5](https://github.com/molikas/axoview/commit/3e91be5f5f306026269c74324a8323ef731ceda1))
* **ci:** remove PR approval step from dependabot automerge - stan ([d87ea8d](https://github.com/molikas/axoview/commit/d87ea8db563587cc76c93aa02b2a5ccae97b2e95))
* console errors ([213a5d6](https://github.com/molikas/axoview/commit/213a5d62e9b082d6910b7e6e5a9e051caa2d4e50))
* controls container now scrolls ([f20580a](https://github.com/molikas/axoview/commit/f20580a6f11f1af7ec9b3d7cc537eb6661466e11))
* Correct Dockerfile FROM AS casing ([a383d57](https://github.com/molikas/axoview/commit/a383d577ce2a60bdec81fc59eace08241d29dbaf))
* correct rectangle reducer and update CI workflow with build step ([2bd1318](https://github.com/molikas/axoview/commit/2bd131844135cb8c5a957c8cd96f2f17455a911a))
* correct typo in integration section of quickstart docs ([1256d30](https://github.com/molikas/axoview/commit/1256d30b684cdea74502fd2c05ac432fe210cc69))
* corrects CodeSandbox setup script ([8548b00](https://github.com/molikas/axoview/commit/8548b000715632b03f2a0ba279a15ad65f6d0a3e))
* corrects connector width issue on zoom ([555244c](https://github.com/molikas/axoview/commit/555244c206d6c3e4682212b267dd6012522b98c0))
* corrects icon filename casing ([9161bbc](https://github.com/molikas/axoview/commit/9161bbc9f09c85e40c7569a54f71fd1e4afeb36b))
* corrects icon reference ([7d5e116](https://github.com/molikas/axoview/commit/7d5e11638e8873fd5dcac7a6e61f706566761dce))
* corrects textbox selection not displaying correctly ([fe7a2ed](https://github.com/molikas/axoview/commit/fe7a2ed21130294b43f35d10dac13a7843ccad4c))
* corrects typo in error message ([4bb73e2](https://github.com/molikas/axoview/commit/4bb73e2a3c7638a374880dc75dd3a964bb099432))
* corrects value of `disableInteractions` ([b34a2b2](https://github.com/molikas/axoview/commit/b34a2b27d3eaedfff3b8cc6ffefafc0a37c88442))
* corrects zoom tooltips ([07011f2](https://github.com/molikas/axoview/commit/07011f2b88c1bcb1130f6f98200ac0f6a727a35e))
* delete connectors by ID instead of index in scene ([67f0dde](https://github.com/molikas/axoview/commit/67f0dde9321eafa8c1ede3790d853a9fff2c9727))
* delete textBox and rectangle from scene when removed ([32bcce5](https://github.com/molikas/axoview/commit/32bcce57b7ed5c99dd855bba15ec6218fc87cb40))
* **diag:** expose __fossflow__ in dev + read active view counts (MQA [#7](https://github.com/molikas/axoview/issues/7) companion) ([4af566d](https://github.com/molikas/axoview/commit/4af566d78671642206e1c8f47a066ddc8f8a8aeb))
* disables animations on scene layer on first render ([8d98b84](https://github.com/molikas/axoview/commit/8d98b84213d6827ec7dacbf59a7e8422ef157f4f))
* displays icons in sidebar ([6878712](https://github.com/molikas/axoview/commit/6878712b0bb2cde2ac535ab363a6794be45f555f))
* drag precision, collision, copy-paste waypoints, language dropdown ([a71257a](https://github.com/molikas/axoview/commit/a71257a4f1a21a1839193c9b4edd3b8add06bee4))
* drag-back-to-origin, App.tsx decomposition, lazy icon packs ([d4626ac](https://github.com/molikas/axoview/commit/d4626ace7ba2e8b733dc4badfb2209e465c0360a))
* easy wins — Zustand deprecation, Quill bullet warning, i18n 404, createModelItem double-write ([6be0a74](https://github.com/molikas/axoview/commit/6be0a745815d95e893800e9cd8529d760410b07f))
* enables textboxes to be selected more easily ([6c3a4ce](https://github.com/molikas/axoview/commit/6c3a4ce6c9dffe6c4f74272d2a4ab3f7615f9d6b))
* excludes `docs` folder from tsconfig ([0d21cf1](https://github.com/molikas/axoview/commit/0d21cf16d325298f7e340cfedf910c976346cd57))
* excludes node_modules from type checking ([68fe053](https://github.com/molikas/axoview/commit/68fe05385cd203f29a28ac6ec9063ed6a3f9f51f))
* explicitly includes tag when publishing to npm ([0b4b7aa](https://github.com/molikas/axoview/commit/0b4b7aadfc6998e4dfbb19b474e8036b0c1fc346))
* failing test ([d4e03b0](https://github.com/molikas/axoview/commit/d4e03b0455c51ed8565b6ff34cb6ef1a19811398))
* failing tests ([21b5579](https://github.com/molikas/axoview/commit/21b557961f71c0754fa8cae375d0d5cfa778e5dd))
* **fileExplorer:** hide share-link in session mode ([a230286](https://github.com/molikas/axoview/commit/a2302866922270a814eae008fbb1da5291e8c4a1))
* first tile not registering when dragging item ([975ce6a](https://github.com/molikas/axoview/commit/975ce6ae926edfe29f0d25a8f8a3da35008208db))
* Fixed issues with history not fully working, undo/redo was hit or miss. Additionally added a huge amount of CI/CD testing using selenium so that we can simulate creating a diagram, placing nodes, connceting them, undo/redo, and rectangles/text as well, with love, Stan ([047df92](https://github.com/molikas/axoview/commit/047df927858417ec068a749a3f6a0c6dd8741fec))
* Fixes [#58](https://github.com/molikas/axoview/issues/58) now allows for CTRL+S and CTRL+O to save/load diagrams, thanks [@fatflyingpigs](https://github.com/fatflyingpigs) for bringing this to my attention ([ed944a0](https://github.com/molikas/axoview/commit/ed944a0b61d93c97917390eabc5bbc165f78ebc1))
* fixes bug caused by missing param in function call ([421bd07](https://github.com/molikas/axoview/commit/421bd07c932ce24ca9c736c6635fcb9b7dd2486f))
* fixes bug with 'unable to find cloneNode' on image export ([971ae23](https://github.com/molikas/axoview/commit/971ae232c373d2bd6ea1ac94ca29242b349fc69c))
* fixes bug with rectangle resizing ([0731757](https://github.com/molikas/axoview/commit/07317570606488776cf305a9f428b9db538655de))
* fixes color resolving mechanic ([4a67974](https://github.com/molikas/axoview/commit/4a67974b55258794b6b84104e71369148893ac6c))
* fixes debug tools dimensions ([6cdc9eb](https://github.com/molikas/axoview/commit/6cdc9ebb3873724655cb80bdef5596c08ab71a11))
* fixes export bug only referencing first view in the model ([ef7c314](https://github.com/molikas/axoview/commit/ef7c314819c1ed368ac7b989754844e6a4271e69))
* fixes failing test ([569e94f](https://github.com/molikas/axoview/commit/569e94ff547ad68fc825e505b110ffe7ecf839e5))
* fixes image export reading non-current scene ([d54b485](https://github.com/molikas/axoview/commit/d54b4855657535b4cfe540eabfe7abe524ca1a9a))
* fixes issue loading model ([33658b3](https://github.com/molikas/axoview/commit/33658b38b182ca3664a94f1b948f971f035cf638))
* fixes issue when clearing the canvas ([0986c52](https://github.com/molikas/axoview/commit/0986c52d6886739339ee6ae10aaf3d94c6521897))
* fixes issue where exported image isn't positioned correctly ([b525b8a](https://github.com/molikas/axoview/commit/b525b8a8ab18b03d7470d79f062a562d45927acb))
* fixes issue with calculating fit-to-screen dimensions ([1ad851a](https://github.com/molikas/axoview/commit/1ad851aaca825bbfbbcd52e0a5ca9d881ea00f5d))
* fixes issue with connector path not being generated correctly ([4257445](https://github.com/molikas/axoview/commit/425744585e433dc4e5111c4d626d944e1a79d66c))
* fixes issue with context menu not displaying correctly when zoomed out ([721e78a](https://github.com/molikas/axoview/commit/721e78ae43d37de569f40c52eb3a6f51b9c3d60b))
* fixes issue with fitToScreen only taking dimensions of first view ([126a77f](https://github.com/molikas/axoview/commit/126a77fdde95de69a859e3e4e509b37a573c72da))
* fixes issue with grid misalignment ([db9f60f](https://github.com/molikas/axoview/commit/db9f60f5693c686540007fd541fc73f47ea879f5))
* fixes issue with initial view not being automatically generated ([533a54c](https://github.com/molikas/axoview/commit/533a54c3e80b6c589898052f80b83d996d0ac4c1))
* fixes issue with reloading scene on window resize ([8f24381](https://github.com/molikas/axoview/commit/8f24381e1bb405d04c03a9df41991d7213d5e741))
* fixes issue with textbox selection ([9903755](https://github.com/molikas/axoview/commit/9903755052109244fb8b8558ff7b34339341a7a5))
* fixes issue with view timestamp ([53a4b61](https://github.com/molikas/axoview/commit/53a4b61c7939e38c82bc3543e5d4778d2f776a24))
* fixes linting scripts in package.json ([693845a](https://github.com/molikas/axoview/commit/693845af024455a3f420ca203fe6a368233181fd))
* fixes nodes not displaying correctly when being dragged onto canvas ([3686515](https://github.com/molikas/axoview/commit/36865152ca9ec0f40fd62b1551c13c006ec5e02f))
* fixes pan mode ([e384934](https://github.com/molikas/axoview/commit/e384934d7c678e072205a7192675a46de450056f))
* fixes zIndex ordering among nodes ([6139401](https://github.com/molikas/axoview/commit/613940171128889c8dc92e5784264849b08ad487))
* forces case sensitive dir names through Git ([01fdfe5](https://github.com/molikas/axoview/commit/01fdfe5da8c34a3cf1c9561e99177b5def3b0b6c))
* handle missing items gracefully in hooks and components ([ac41ed7](https://github.com/molikas/axoview/commit/ac41ed7768679660f81a90215d5503a2d653cf52))
* handle orphaned connector references when deleting items ([#139](https://github.com/molikas/axoview/issues/139)) ([d698a1a](https://github.com/molikas/axoview/commit/d698a1a120f8759e13618b962baa54d3b1d8cc22))
* hide canvas node description when cleared in editor ([5128765](https://github.com/molikas/axoview/commit/5128765a6ffa8de71ceeeee1eadcb745593e17b4))
* hides label when no content to display ([e2e2866](https://github.com/molikas/axoview/commit/e2e2866a1c9fc08c8b41b8d9a7a7ac66bde69008))
* highlight hamburger menu icon when main menu is open ([0eb0881](https://github.com/molikas/axoview/commit/0eb0881a60fecd882746b13d742d1bb70c785bc7))
* **i18n:** backfill missing translations + strip orphan keys across 12 locales ([215f1f3](https://github.com/molikas/axoview/commit/215f1f3d1129b808cc8cfe8a046e4161f1e72e44))
* icon packs (aws/gcp/azure/k8s) not loading on startup ([43166fd](https://github.com/molikas/axoview/commit/43166fdc781449572962a4548709ec7cd64a625a))
* **icon-packs:** auto-load packs needed by an imported diagram ([ff9665f](https://github.com/molikas/axoview/commit/ff9665fd9d1c533072f6723256e0650c3ae0a6a6))
* implements various minor fixes ([7e0c18d](https://github.com/molikas/axoview/commit/7e0c18d8b48d14bf38009524a4cea43a81eeb262))
* improve item control handling in Cursor and DragItems modes ([02fae75](https://github.com/molikas/axoview/commit/02fae7558c0a3260910f2e1a61797de450bb4d94))
* Increase nginx client_max_body_size to 10MB for larger diagrams ([fb3e171](https://github.com/molikas/axoview/commit/fb3e171256b6c168bada46e43f8317e274df1447))
* issue with first group drawn not displayed ([2cb9648](https://github.com/molikas/axoview/commit/2cb96483034564291e12ee0a3c38f1e17ca25288))
* issue with scrolling icons ([68e451a](https://github.com/molikas/axoview/commit/68e451aa4987dfc25377217d86532d1c12130bcc))
* issue with skipping tiles while dragging nodes ([15bb5fb](https://github.com/molikas/axoview/commit/15bb5fb6d0dee0cbf86cad38c8944c254658d178))
* issues with manipulating stale groups when dragging ([f0e6766](https://github.com/molikas/axoview/commit/f0e6766a441fdd9681100c9f8b8f3cb85f9b4774))
* Keep connector tool selected after creating a connection ([64612a5](https://github.com/molikas/axoview/commit/64612a592c211155ca2b97993a3daf89020b6d6f))
* label heights on nodes ([fc20387](https://github.com/molikas/axoview/commit/fc20387e7d67fdb51cb202d97dffd970ac706cb8))
* lasso drag when clicking on a node within selection ([af5ba19](https://github.com/molikas/axoview/commit/af5ba19daa7bbc01f708fecae4c7dcf10cb39b01))
* lasso first-click bug and sporadic canvas ghost-image drag ([fefcafb](https://github.com/molikas/axoview/commit/fefcafb5125eeee110b36b758c539d4ffa25885a))
* lasso wasnt moving nodes if there was also a text item in the selection, now it works ([f5ce168](https://github.com/molikas/axoview/commit/f5ce1689c9c3ceaa0b180d4c165914c64f3252ec))
* layers drag-to-layer, non-iso icon elevation, diagnostics toggle ([cd72a59](https://github.com/molikas/axoview/commit/cd72a590eb303a5581b32d64ae0c02af6948120b))
* linting errors ([04fa3cf](https://github.com/molikas/axoview/commit/04fa3cfe7729acc0a22c15e847241da255698fec))
* make dotted line transparent to click events ([#190](https://github.com/molikas/axoview/issues/190)) [@majiayu000](https://github.com/majiayu000) ([554325a](https://github.com/molikas/axoview/commit/554325ad129529d8938756204f6be89e622d6f0b)), closes [#61](https://github.com/molikas/axoview/issues/61)
* makes node icons dynamic ([9c7e293](https://github.com/molikas/axoview/commit/9c7e2932b02188e92e1b64980890bc21f44a7bfb))
* makes onSceneChange an optional prop ([bd26647](https://github.com/molikas/axoview/commit/bd26647b607c35e0c8bc443f21e548adcc42d611))
* malformed CI config ([73c795b](https://github.com/molikas/axoview/commit/73c795bdb72b33cb3cb993925cb8e0add6f59015))
* memoized tools and other components as they were causing again more re-renders, this improves performance a touch ([e011f8c](https://github.com/molikas/axoview/commit/e011f8cea2acd9e46efd9a9713dc3aaf94d923d5))
* missing `textboxes` definitions in initialData ([e72dd84](https://github.com/molikas/axoview/commit/e72dd842c9729672a9af5989482db6b3e409b403))
* moves zustand devtools from devDeps to deps (solves linting issue) ([cd70da3](https://github.com/molikas/axoview/commit/cd70da3a27e8a338e2687c81207427505e9a588e))
* MQA [#22](https://github.com/molikas/axoview/issues/22)/[#25](https://github.com/molikas/axoview/issues/25) panel UX polish + strip [#5](https://github.com/molikas/axoview/issues/5) diagnostic logs ([d65f1a9](https://github.com/molikas/axoview/commit/d65f1a9dbc7ad23fe53032e195d7859fb247a089))
* MQA [#5](https://github.com/molikas/axoview/issues/5) (scene undo/redo direction) + [#22](https://github.com/molikas/axoview/issues/22)/[#25](https://github.com/molikas/axoview/issues/25) panel approach ([0a8869a](https://github.com/molikas/axoview/commit/0a8869a376fd727f2c4df405523fdd06e77d4c6d))
* MQA Bundle B — 10 fixes + Export Compact removal (2026-05-15) ([08f1f8b](https://github.com/molikas/axoview/commit/08f1f8b421d7744945f72727efbaff5d6f574b28)), closes [#7](https://github.com/molikas/axoview/issues/7) [#5](https://github.com/molikas/axoview/issues/5) [#12](https://github.com/molikas/axoview/issues/12) [#13](https://github.com/molikas/axoview/issues/13) [#14](https://github.com/molikas/axoview/issues/14) [#18](https://github.com/molikas/axoview/issues/18) [#21](https://github.com/molikas/axoview/issues/21) [#22](https://github.com/molikas/axoview/issues/22) [#24](https://github.com/molikas/axoview/issues/24) [#17](https://github.com/molikas/axoview/issues/17) [#7](https://github.com/molikas/axoview/issues/7)
* MQA Bundle B follow-up — connector-redo, import-409, preview redesign ([1f823f8](https://github.com/molikas/axoview/commit/1f823f86638511c208f5a2efce3b497228a3634c)), closes [#5](https://github.com/molikas/axoview/issues/5) [#14](https://github.com/molikas/axoview/issues/14) [#22](https://github.com/molikas/axoview/issues/22) [#25](https://github.com/molikas/axoview/issues/25) [#22](https://github.com/molikas/axoview/issues/22) [#25](https://github.com/molikas/axoview/issues/25)
* MQA Bundle B follow-up [#2](https://github.com/molikas/axoview/issues/2) — preview menu redesign + [#5](https://github.com/molikas/axoview/issues/5) diagnostics ([660573b](https://github.com/molikas/axoview/commit/660573bc8171347f3529162d0fa612473b7718a6)), closes [#22](https://github.com/molikas/axoview/issues/22) [#25](https://github.com/molikas/axoview/issues/25)
* node link URL, rect z-order, stacked rect hit-test, save-as, connector waypoints ([0db8c2a](https://github.com/molikas/axoview/commit/0db8c2aac5ee0ffe2903c5fa981921a9d057a6f7))
* nodemon not watching for file updates ([dfab4c2](https://github.com/molikas/axoview/commit/dfab4c243d9864da5f8c8e938aa417060d941da0))
* omits git tag prefix to align with npm semver requirements ([408d776](https://github.com/molikas/axoview/commit/408d7760b2f88862675ba8f486cc4b7708a65855))
* omits git tag prefix to align with npm semver requirements ([5251bec](https://github.com/molikas/axoview/commit/5251bec23c3bf10962dd460d1e95c7a19cad6311))
* on-demand icon packs, diagram name sync, compact format loading ([599a46d](https://github.com/molikas/axoview/commit/599a46dc42f2ffdcd2fb922b9df0d3e1a5b1668b))
* passes full list of connector properties ([a19ea29](https://github.com/molikas/axoview/commit/a19ea291413ac4d7767db08625b9425bb9607a6e))
* post-rename smoke-test items (attribution, cleanup, orphan dist) ([926e66f](https://github.com/molikas/axoview/commit/926e66fd928594836edef639414bc7a17f0952ab))
* preserve connector persistence without breaking image export ([650045d](https://github.com/molikas/axoview/commit/650045d9589d3af7e86102019666d08ab747942c))
* prevents unnecessary rerenders ([9722a62](https://github.com/molikas/axoview/commit/9722a622fc4f6070b3d705673d3c9357c57bfb99))
* reduce console noise, fix aria-hidden, migrate old icon format ([87c227b](https://github.com/molikas/axoview/commit/87c227beaa822f7fde3d1741acfae159dd27aee9))
* reinstates debug tools ([6bf1740](https://github.com/molikas/axoview/commit/6bf17402b345b62e9021ed163b2150ca1337097a))
* remove duplicate downloadFile and useEffect in ExportImageDialog ([#109](https://github.com/molikas/axoview/issues/109)) ([8db2710](https://github.com/molikas/axoview/commit/8db2710c7a9a7e05e63cfecddd6f011339bd64c6))
* remove duplicate title, fix multi-view save tracking, language dropdown overflow ([4706504](https://github.com/molikas/axoview/commit/4706504487317218cd5055795973ebd70e061438))
* remove icon position glitching when placing icon ([#268](https://github.com/molikas/axoview/issues/268)) ([c3b48f1](https://github.com/molikas/axoview/commit/c3b48f13ec5a20c6b3637097bdcc7e38b135b6ce))
* remove stale TAB_READONLY_NOTES reference in NodePanel ([db80816](https://github.com/molikas/axoview/commit/db80816c1f7634f67d3daa5c5650af29a522be5c))
* removes "fit to screen" tool ([302d4b8](https://github.com/molikas/axoview/commit/302d4b8695eb42fd47aaf0fbdd155cab162fd031))
* removes autobind to fix failing tests ([b050d4c](https://github.com/molikas/axoview/commit/b050d4cec4b7257992b51f27c80803bd16cb63fa))
* removes console log ([7f12fbc](https://github.com/molikas/axoview/commit/7f12fbc052f30aa99115c705022e4947d174c1bb))
* removes console.log ([494a6a0](https://github.com/molikas/axoview/commit/494a6a0a7cd37da05e3cc9d5afe37d8054c1522b))
* removes old logo asset ([8c63ec3](https://github.com/molikas/axoview/commit/8c63ec3594208c0927ec98b75b5540be9ae6723b))
* removes redundant function calls ([fd5258e](https://github.com/molikas/axoview/commit/fd5258e38cbbd6c1e6a478664311eefcf39fcc4f))
* removes redundant hook ([f13d3a6](https://github.com/molikas/axoview/commit/f13d3a60fbc368f027915c00f3aceb82cacebfbf))
* removes redundant prop ([0b64ffd](https://github.com/molikas/axoview/commit/0b64ffd27a97c5100a89748d363cdc2b3e201e35))
* removes references to window size, replaces with renderer size ([50c7323](https://github.com/molikas/axoview/commit/50c73235fe5e1ed7247c4224dde977159fcdfe60))
* removes sidebar on controls panel ([6a152ee](https://github.com/molikas/axoview/commit/6a152ee7a756a8e7e5842af44780d7f233a3ee12))
* removes touchmove for now ([6f028fa](https://github.com/molikas/axoview/commit/6f028faa3c4ebc9d88ebfea489e00560a61c8dfd))
* removes unnecessary import ([1e95cf9](https://github.com/molikas/axoview/commit/1e95cf9e37d25f790f85f53326e8f3f05a737008))
* removes unnecessary imports ([3dbc5fc](https://github.com/molikas/axoview/commit/3dbc5fc4bf87e87f48f6547d7e461e84af3513fb))
* removes unnecessary param in tsconfig ([8f24b09](https://github.com/molikas/axoview/commit/8f24b0970ce4f6158b2f0eac54d31a89d87499b7))
* removes unrecognised svg attributes ([f1b18e5](https://github.com/molikas/axoview/commit/f1b18e56386c8f70379d7a5e961ff937731d8ee6))
* removes unrecognised svg attributes ([0e9eac1](https://github.com/molikas/axoview/commit/0e9eac16b89b72571bfd8eaad0717e09c3304a41))
* removes unrecognised svg stroke param ([6df12e3](https://github.com/molikas/axoview/commit/6df12e35e3141771d910ec2ae6b6f1297c8a7da5))
* removes unused package dependency ([5f63a4d](https://github.com/molikas/axoview/commit/5f63a4d4d68e16e0da0df6d3f13b07e9c66732f9))
* removes unused prop ([d7ddb69](https://github.com/molikas/axoview/commit/d7ddb69567f02e815b8b911c07e4026f8b36e764))
* removes unused ref ([f7532c2](https://github.com/molikas/axoview/commit/f7532c2b85bf4a70487b8aae83f3c971259c7d19))
* resets item controls on drag ([7adb20f](https://github.com/molikas/axoview/commit/7adb20f9bafa99953704d94b1828a8689de6c850))
* resolve connector persistence issues ([#110](https://github.com/molikas/axoview/issues/110)) ([2733f0b](https://github.com/molikas/axoview/commit/2733f0b7dfb2f4ba44dcf1da6963ffcb2dc76297)), closes [#103](https://github.com/molikas/axoview/issues/103)
* resolve flickering issue ([#203](https://github.com/molikas/axoview/issues/203)) ([#215](https://github.com/molikas/axoview/issues/215)) @Abrar74774 ([dd2b782](https://github.com/molikas/axoview/commit/dd2b782398f932597a8726906107a088a7b68b59))
* resolve issue [#136](https://github.com/molikas/axoview/issues/136) where "Add Node" popup has huge offset ([#195](https://github.com/molikas/axoview/issues/195)) ([fa5478e](https://github.com/molikas/axoview/commit/fa5478e709f187a9a5b458a967dd99c2ed9da69b))
* resolve issue [#198](https://github.com/molikas/axoview/issues/198) where moving sliders pan view ([#199](https://github.com/molikas/axoview/issues/199)) ([af62f2f](https://github.com/molikas/axoview/commit/af62f2f9b54d45f219fc442510bc7b359cc2b6d7))
* resolve multi-load, service worker loop, and storage dev bypass ([4fe8ac7](https://github.com/molikas/axoview/commit/4fe8ac7fe6c7868af560682a3793fe31c942f8c9))
* Resolve pan control configuration issues ([2310b85](https://github.com/molikas/axoview/commit/2310b85995ee2f64a38a40ef57de527edfbf3560)), closes [#57](https://github.com/molikas/axoview/issues/57)
* resolve quill XSS vulnerability (GHSA-v3m3-f69x-jf25) ([4bb9bdf](https://github.com/molikas/axoview/commit/4bb9bdf0b915405bf42b274b09e87ae859564386))
* resolve security vulnerabilities in dependencies ([023c1e9](https://github.com/molikas/axoview/commit/023c1e902f2cd2dd35cb5440f2d4afe6ac12c55d))
* resolve webpack and TypeScript declaration file conflicts ([2630d42](https://github.com/molikas/axoview/commit/2630d421020f658e4e5c5451626cc28adf553b28))
* resolves paths after typese are compiled ([b2416f3](https://github.com/molikas/axoview/commit/b2416f3e984e1e474b7ef561d82259216ea3bf7b))
* returns only first item after a click on a tile (for efficiency) ([b220c25](https://github.com/molikas/axoview/commit/b220c25fe0a2d57a6d7b4a3bdf159b2f70d81887))
* reverts experimental mechanic to test efficiency gains ([94fbf4b](https://github.com/molikas/axoview/commit/94fbf4bba2931744a81b4f6b3c97cd8f2758bf2a))
* scales label height according to zoom ([51f0d4f](https://github.com/molikas/axoview/commit/51f0d4fd4b154bb93880f09bd7fefa70edf86c6d))
* session-mode autosave folder, canvas rename, JSON title round-trip ([a802ebc](https://github.com/molikas/axoview/commit/a802ebc68ace70ddfebe7019f4d5e3de67adcb92))
* sets node focus correctly ([af2d96d](https://github.com/molikas/axoview/commit/af2d96d77b3653fb15399f390d3f3b83905b9855))
* shows grid when in edit mode ([56621f3](https://github.com/molikas/axoview/commit/56621f3a275776e9010e745fd38fe042c62cc96f))
* static analysis cleanup — hooks, dead code, unused imports, CVE patches ([c083b22](https://github.com/molikas/axoview/commit/c083b221c04edb56c7e0dae7c5e95f2bd8ae75df))
* **storage:** unique local ids to prevent import-time tree cycle ([9867eb7](https://github.com/molikas/axoview/commit/9867eb7cd57b9af74e4e60940d2287c69386e238))
* strange cursor behaviour when zoomed out ([ccf267d](https://github.com/molikas/axoview/commit/ccf267dca5eb99b6bd033f1b4057132ebb49dade))
* syncs lock file with package.json ([1c8f74a](https://github.com/molikas/axoview/commit/1c8f74aac720ddb3114be632447103551315e2b4))
* tests not passing ([029bcf6](https://github.com/molikas/axoview/commit/029bcf6606c32c75e3c381eeaca2026818e12de1))
* typings ([db49988](https://github.com/molikas/axoview/commit/db499881a9e2c39b64c1e9467e46a50d6ec8a7d3))
* typo ([fe68a69](https://github.com/molikas/axoview/commit/fe68a6920f27a41db87382cc80a353d56d37baa8))
* ui bug when creating scene elements ([2158b5e](https://github.com/molikas/axoview/commit/2158b5e523d92bbf3b681cbdecc20d5ca39132b2))
* **ui:** make settings tabs scrollable to prevent hiding ([#238](https://github.com/molikas/axoview/issues/238)) [@0x-la1n](https://github.com/0x-la1n) ([42835fe](https://github.com/molikas/axoview/commit/42835fe0b77458fdff7f32f884ae2ee6506efdc7))
* Update Docker run command to use absolute path for volume mount ([617b865](https://github.com/molikas/axoview/commit/617b8654804a9d41d2dea5d61c68c2ca9feb1dca))
* updates CI config to only trigger on updated tags ([b1dd426](https://github.com/molikas/axoview/commit/b1dd426fbe312e02d523a0ae8329fc7e9d4027ce))
* updates documentation ([d35db15](https://github.com/molikas/axoview/commit/d35db1539d4a617cb5095120798bba9f5d1956d6))
* updates documentation link prefixes ([61e03f3](https://github.com/molikas/axoview/commit/61e03f3367514b3c7d665796a52b14b488c3e727))
* updates package to be compatible with others ([db28d94](https://github.com/molikas/axoview/commit/db28d949060840fc1aab90f9250cf3094140e7b2))
* upgrade to dom-to-image-more for better maintenance ([5d6cf0e](https://github.com/molikas/axoview/commit/5d6cf0e41a7e388fbfa1998ddb154c155b686ad4))
* use relative path for i18n loading on GitHub Pages ([2091aa0](https://github.com/molikas/axoview/commit/2091aa0cca2654ae7c4a0feeb704223b3d234f13))
* uses next/router rather than next/navigation ([a638fde](https://github.com/molikas/axoview/commit/a638fde14f22d880190109c978baaefac4614e59))
* UX polish — 12 PO issues + toolbar propagation + context menu guards ([1d153ac](https://github.com/molikas/axoview/commit/1d153ac01ab95a216798aac8185655d22025ced8))
* **ux:** pointer cursor on clickable preview-mode nodes ([f6670d2](https://github.com/molikas/axoview/commit/f6670d2a39df58a265bc30ceaf098b958ee1f3c6))
* **welcome:** drop Community Edition + hamburger hint; new Axoview branding ([658925f](https://github.com/molikas/axoview/commit/658925f74682871a8daaa349f2e3d4bf360d2fa6))
* workaround for mobx to work correctly with modemanager ([4a9d918](https://github.com/molikas/axoview/commit/4a9d91855572db75dbd0fe5ce48e70ed20d01afb))

### Performance

* 2026.5.10 — connector drag transactions + closed-form router ([7164b3b](https://github.com/molikas/axoview/commit/7164b3be8a13a230c8f43a32552f0a9fc14fcfcb))
* 6 targeted optimizations for paste and hover scalability ([b25fdd3](https://github.com/molikas/axoview/commit/b25fdd3558ba56ea09434c00c3eabc77ed091611))
* CSS-only drag preview eliminates MQA [#7](https://github.com/molikas/axoview/issues/7) cliff (Path 4-true) ([7e09fba](https://github.com/molikas/axoview/commit/7e09fba188302410597557a7106f99194e391d53))
* eliminate React render cycle for pan/zoom, add memo to scene layers ([7a2749a](https://github.com/molikas/axoview/commit/7a2749ac2437031255a59a40dbcce60ca57131cf))
* eliminate render hotspots — N-1 through N-5, H-3, M-1 ([2e37683](https://github.com/molikas/axoview/commit/2e3768342ab9a5cb6d302faa25bb69d542f995eb))
* fix CPU/memory hotspots identified in arch review ([7a554ba](https://github.com/molikas/axoview/commit/7a554baf403862f4a1bb441b3a8abe146488f114))
* fix render churn + add DiagnosticsOverlay; update docs ([ff9dad6](https://github.com/molikas/axoview/commit/ff9dad60d8c813bc05b52574a1424a7e8af11cc7))
* per-connector subscriptions, A* cache, startTransition, redo fix, docs ([91d7ca7](https://github.com/molikas/axoview/commit/91d7ca70fe50413d59ae3eec9c6df1cddc9deac2))
* refactored useScene and store subscriptions for performance gains ([7f97e07](https://github.com/molikas/axoview/commit/7f97e074bb436fe237195af136bac53791608baa))
* runtime fixes R-1, R-2, R-4, R-5 ([af3773a](https://github.com/molikas/axoview/commit/af3773ae6ba181ba05d13d775408b4eaf7f334b7))
* split Node into position shell + memoized NodeContent (MQA [#7](https://github.com/molikas/axoview/issues/7) Path 2) ([728b229](https://github.com/molikas/axoview/commit/728b229e606124f1c1ab921271b544b352fbbe2d))
* SVG export optimizer — Phase 1/2/3 (940KB → 750KB) ([7a66ebe](https://github.com/molikas/axoview/commit/7a66ebe0aeafc73987783a9d33f88cfb486f2f8a))
* wrap DragItems in begin/commitDragTransaction (MQA [#7](https://github.com/molikas/axoview/issues/7) partial) ([bba712c](https://github.com/molikas/axoview/commit/bba712c8058850eed5d8f329644bf816bb2369ff))

### Reverts

* fix: excludes node_modules from type checking ([8b5332b](https://github.com/molikas/axoview/commit/8b5332ba9f6b5108580c70bbf95a34bde8e965ae))
* removes explicit definition of tag used for npm ([b1bcb30](https://github.com/molikas/axoview/commit/b1bcb302371d48e560bf7e6954d0963d63f709ce))
* Revert "Enhance ExportImageDialog performance and UX ([#100](https://github.com/molikas/axoview/issues/100))" ([#101](https://github.com/molikas/axoview/issues/101)) ([dbdaf02](https://github.com/molikas/axoview/commit/dbdaf02da2a17946841c1fecd1964e6ebe837d1d))

### Documentation

* add chinese README.md ([#117](https://github.com/molikas/axoview/issues/117)) ([556ef4a](https://github.com/molikas/axoview/commit/556ef4a3742a21e0681ef8fcd4d7968794db4ddb))
* add current_architecture.md and raw analysis ([6e84489](https://github.com/molikas/axoview/commit/6e844890d28e2c4100e5f95855abd87fafd0b61f))
* Add custom icon import feature to README with icon resource links ([6d53f08](https://github.com/molikas/axoview/commit/6d53f083176f42d70a04344b681b8b706f5b04f0))
* add future_features.md with FF-001 right-click pan transient/sticky rework ([e8475e3](https://github.com/molikas/axoview/commit/e8475e330661dc600ab066a0ee1cd715441104c2))
* add missing language cross-references to all READMEs ([806cf08](https://github.com/molikas/axoview/commit/806cf08681a14b68a264279930c9194deb416775))
* add regression_tests.md — full suite reference (465 tests, 51 suites) ([1a65fdf](https://github.com/molikas/axoview/commit/1a65fdf9ddb60725ad34b0ca1a38352a95951db3))
* add user-friendly summary to root README, remove duplicate app README ([3069b8b](https://github.com/molikas/axoview/commit/3069b8b7740f83f6a0c8780cd39c9ba4c1aea8b2))
* add UX principles reference ([c5e873e](https://github.com/molikas/axoview/commit/c5e873e4efd9e2cf33a4510aad56b4a10f2941c3))
* **adr:** note requiredPacks addition to lean-save contract (0003) ([0c07982](https://github.com/molikas/axoview/commit/0c079823446ef4262876b511da763a750bffa9d5))
* expand 'What This Fork Adds' with node links, font size, text formatting ([d82fc9c](https://github.com/molikas/axoview/commit/d82fc9c445a07e946f73b7a9dfb170342181bb35))
* fix remaining CONTRIBUTING.md links in readme ([#197](https://github.com/molikas/axoview/issues/197)) @Abrar74774 Thank you! ([cbf922d](https://github.com/molikas/axoview/commit/cbf922d400aa9d5dc616e2269685e0700c45b91b))
* **notes:** end-of-session sync — 2026-05-09 ([b0dddd8](https://github.com/molikas/axoview/commit/b0dddd8744b62573117b621c49d110772f4d5406))
* **notes:** end-of-session sync — 2026-05-10 — release 2026.5.11 ([c450559](https://github.com/molikas/axoview/commit/c4505595d8346e5f54fe1634f99ff5e28e2721e2))
* **notes:** end-of-session sync — 2026-05-16 ([5f38fec](https://github.com/molikas/axoview/commit/5f38fec3b677c147354989657ab5b37f6d510ae5)), closes [#5](https://github.com/molikas/axoview/issues/5) [#12](https://github.com/molikas/axoview/issues/12) [#13](https://github.com/molikas/axoview/issues/13) [#14](https://github.com/molikas/axoview/issues/14) [#16](https://github.com/molikas/axoview/issues/16) [#17](https://github.com/molikas/axoview/issues/17) [#18](https://github.com/molikas/axoview/issues/18) [#21](https://github.com/molikas/axoview/issues/21) [#22](https://github.com/molikas/axoview/issues/22) [#24](https://github.com/molikas/axoview/issues/24) [#25](https://github.com/molikas/axoview/issues/25) [#5](https://github.com/molikas/axoview/issues/5)
* **readme:** add live demo link at top ([3e59e4b](https://github.com/molikas/axoview/commit/3e59e4b2309c157819bdf8f7d2a2c22bdadd64e9))
* release notes + architecture update for Phases 0A–2C ([e3867ca](https://github.com/molikas/axoview/commit/e3867ca6113a8439de37942ec81cfc5dcae5a35a))
* removed cruft from readmes ([daa0dd3](https://github.com/molikas/axoview/commit/daa0dd3b76162278f79f1a2c1b063df1505c8ce1))
* **rename:** public attribution + splash + About tab + LICENSE ([badbc25](https://github.com/molikas/axoview/commit/badbc25d6cdb698e09e5413147b0c95407901d00)), closes [#12](https://github.com/molikas/axoview/issues/12)
* reorder changelog newest-first (2026-03-29 before 2026-03-27) ([82196e2](https://github.com/molikas/axoview/commit/82196e22eb329c281e33f0ac8b6842efaad12077))
* restructure and consolidate all repository documentation ([3059e5b](https://github.com/molikas/axoview/commit/3059e5b3268f40483537e700d037c278f81a7461))
* sharpen README — remove fluff, tighten changelog and feature bullets ([94e284a](https://github.com/molikas/axoview/commit/94e284a7c312eba10be584097d86e78ece86f22d))
* **tactical:** close MQA Bundle B — all 11 items shipped ([78bedfd](https://github.com/molikas/axoview/commit/78bedfd6961cf001abf74e434b075dd37e1d175c)), closes [#5](https://github.com/molikas/axoview/issues/5) [#12](https://github.com/molikas/axoview/issues/12) [#13](https://github.com/molikas/axoview/issues/13) [#14](https://github.com/molikas/axoview/issues/14) [#16](https://github.com/molikas/axoview/issues/16) [#17](https://github.com/molikas/axoview/issues/17) [#18](https://github.com/molikas/axoview/issues/18) [#21](https://github.com/molikas/axoview/issues/21) [#22](https://github.com/molikas/axoview/issues/22) [#24](https://github.com/molikas/axoview/issues/24) [#7](https://github.com/molikas/axoview/issues/7) [#7](https://github.com/molikas/axoview/issues/7)
* **tactical:** mark MQA [#25](https://github.com/molikas/axoview/issues/25) resolved — shipped 2026-05-15 in d65f1a9 ([325e29e](https://github.com/molikas/axoview/commit/325e29e555aa3fc5d05201b242e0ed88103a6de5))
* **tactical:** rename FossFLOW -> Axoview tactical plan ([e66e7bc](https://github.com/molikas/axoview/commit/e66e7bc8d4f03e21cfd14d37b59d0447e3361bce))
* trim README — compact Performance section and Getting Started ([1ad4425](https://github.com/molikas/axoview/commit/1ad4425546da43d47578bdc57ec08dc356130160))
* update 2026-03-27 changelog with console/aria/migration fixes ([9b2a485](https://github.com/molikas/axoview/commit/9b2a4857ead5dad61bbfb18bf31ead54654b087d))
* update all project docs to reflect 2026-03-22 commits ([3fd205a](https://github.com/molikas/axoview/commit/3fd205a67de29ea36686232131cd7bafe065da4a))
* update API documentation for initialData and renderer props ([ab7f2e6](https://github.com/molikas/axoview/commit/ab7f2e69992a9e27177a474a28258cad997adc56))
* update contributing.md ([011f0af](https://github.com/molikas/axoview/commit/011f0aff1d8cc38ac54eb4934a8ec775c1915b53))
* Update CONTRIBUTORS.md ([#89](https://github.com/molikas/axoview/issues/89)) ([d6fab61](https://github.com/molikas/axoview/commit/d6fab61d56e2d8f91d13ec80d45581a905e4a3c0))
* Update CONTRIBUTORS.md for monorepo structure ([526aeab](https://github.com/molikas/axoview/commit/526aeab397dc0c8877af3ccf624d96c9ed5f7cd0))
* Update encyclopedia for monorepo structure ([94bf3c0](https://github.com/molikas/axoview/commit/94bf3c0596eed6901edd64adc147a253535e5948))
* update README and architecture with 2026-03-30 code quality changes ([ab2eb7e](https://github.com/molikas/axoview/commit/ab2eb7e6dcf50d9d2ea8bc42a44b20540cee5177))
* update README and current_architecture.md with easy wins + regression suite ([955797d](https://github.com/molikas/axoview/commit/955797d6cf009b8dc1a2ecfbe57b745533009fc9))
* update README with changelog and keyboard shortcuts ([5cc8fbc](https://github.com/molikas/axoview/commit/5cc8fbc5aeed341088bd1fc4ed5c6ae325ff8100))
* Update README with comprehensive monorepo information ([979c05d](https://github.com/molikas/axoview/commit/979c05d59b194a964566467d86a0efe4a052ac4f))
* **ux:** codify panel-header hover-reveal + lock/hide enforcement contract ([508f1af](https://github.com/molikas/axoview/commit/508f1afab76f2c315c681cd2dcc7fe1e05be2b69)), closes [#2](https://github.com/molikas/axoview/issues/2)

### Code Refactoring

* 6-phase architecture cleanup — split god-objects, instance clipboard, settings persistence ([090ce10](https://github.com/molikas/axoview/commit/090ce10375af05427a692eeff0cb871ef902988f))
* add title to Section in TextBoxControls ([1bc1e5e](https://github.com/molikas/axoview/commit/1bc1e5eb995a8e1a23e237113aedc492b1f917b5))
* applies origins of 0,0 to all scene layers ([ba44af5](https://github.com/molikas/axoview/commit/ba44af5c87170c5affdea2e7c44380b46ad883e1))
* bumped react18 to react19 along with associated deps and changes needed, long time coming, fixes [#72](https://github.com/molikas/axoview/issues/72), thanks [@mmastrac](https://github.com/mmastrac) for providing some of the groundwork - Stan ([2fa3a3c](https://github.com/molikas/axoview/commit/2fa3a3c970ea5dba944bb666f42a1f6ec7725595))
* connector functionality ([b2bf329](https://github.com/molikas/axoview/commit/b2bf329e84c51cf1070ff9144beb4182da8bd908))
* encapsulates ui menu styling in own component ([bd91210](https://github.com/molikas/axoview/commit/bd91210e6be12fd9636ad511b20ce973623c51ed))
* implements more efficient calling of onSceneUpdate() ([0306597](https://github.com/molikas/axoview/commit/030659709cebe3b75e482a3dec6369bdcb77471a))
* integrates the renderer with react ([773473b](https://github.com/molikas/axoview/commit/773473b58e8602a0e0a2a83b0b0a712b8402e669))
* **lib:** rename public API Isoflow -> Axoview (preserves @isoflow/isopacks) ([6390e0d](https://github.com/molikas/axoview/commit/6390e0d33a0e9ef0b68d3514a799eb90e55d9c14)), closes [#12](https://github.com/molikas/axoview/issues/12)
* migrate away from paperjs [PHASE 1] ([8e6995c](https://github.com/molikas/axoview/commit/8e6995c615d9eb5ba435d56d5b813ae5ec151123))
* migrate away from paperjs [PHASE 2] ([4da4235](https://github.com/molikas/axoview/commit/4da4235eda972422b4247f6433f3721b8399651e))
* minor code style updates ([dba4b3b](https://github.com/molikas/axoview/commit/dba4b3b687ece97b92de357a9a58631cb1e8a579))
* moves /tests/fixtures to /fixtures ([fd8b16a](https://github.com/molikas/axoview/commit/fd8b16afe2c6e9db804a0114be83fc7c88e3ae3f))
* moves model types to model file ([3bf59ef](https://github.com/molikas/axoview/commit/3bf59ef2b921617d35efb10bbb2b1b59392b9c4d))
* moves state to context ([ad34781](https://github.com/molikas/axoview/commit/ad347817ff9ea1601547e87e7ed0c3606e576566))
* moves ui elements into own component ([ca91184](https://github.com/molikas/axoview/commit/ca91184b6ad71c06bbc5005a77ecf7c61835f116))
* moves Ui layer styling to parent component ([d581f28](https://github.com/molikas/axoview/commit/d581f28d01d5ffa666687067d887e8cc59deed9e))
* Phase 0A — App.tsx decomposition into providers ([10db6d5](https://github.com/molikas/axoview/commit/10db6d53957be873bede61963cd1b381d4c1ccd0))
* propagates all naming of groups to rectangles ([cdaaea4](https://github.com/molikas/axoview/commit/cdaaea4c3e72d1eee234aca9d96febe144125e75))
* propagates renaming of rectangle tool ([514dd7a](https://github.com/molikas/axoview/commit/514dd7a6b6471e3bba8e2431f485cafb356cbb4b))
* refactors both connector and node labels to be single component ([49c9f9b](https://github.com/molikas/axoview/commit/49c9f9b70e43a81fb85769af04c0708f2ed06915))
* refactors connector style into a zod enum ([1e950a7](https://github.com/molikas/axoview/commit/1e950a7b5560aa84212c0843c6f05578594c726b))
* remove redundant setMode calls in interaction modes ([fa4490f](https://github.com/molikas/axoview/commit/fa4490fb07c77b48e432ea2f9cf6ef01a8ad5fde))
* remove unnecessary vertical divider from ToolMenu ([11a9f61](https://github.com/molikas/axoview/commit/11a9f61d5f2221fe036a59a3d38284e18aee5ac3))
* remove unused layer ordering functionality ([#118](https://github.com/molikas/axoview/issues/118)) ([b5b2825](https://github.com/molikas/axoview/commit/b5b28257a56a061c64a5f3e4129eada483a66c35))
* removes non-useful hooks ([bf96554](https://github.com/molikas/axoview/commit/bf965549483684ec3776ea3ad79a7256532d8fc2))
* removes size prop from menu props ([ce543d5](https://github.com/molikas/axoview/commit/ce543d5a3d29375a2579c96df33f65fc3ac6b2b9))
* rename workspace folders packages/fossflow-* -> packages/axoview-* ([33d4d71](https://github.com/molikas/axoview/commit/33d4d71b9874b5bcbf82fe1aa960a181fe25a090))
* renames areaTool -> rectangleTool ([8a28036](https://github.com/molikas/axoview/commit/8a280367d0e4403464e01a017d17affb111f4c03))
* renames connector name -> description ([804b4f6](https://github.com/molikas/axoview/commit/804b4f66c7ba601be7cc7c199081d3424fa0bd9a))
* renames initialScene -> initialData ([ab5c778](https://github.com/molikas/axoview/commit/ab5c778780838af3ff3bb454b666f04ab630fea3))
* renames interactionsEnabled > disableInteractions ([436cac1](https://github.com/molikas/axoview/commit/436cac10a08ea0380eafa8fc76ea2cc2bc92fa45))
* renames main menu options for better handling ([84d5015](https://github.com/molikas/axoview/commit/84d5015db336055868645ebe2605f6a54598c878))
* renames node.position to node.tile ([41e8de6](https://github.com/molikas/axoview/commit/41e8de6cc71cb41fe7a8f6fd9420479d112b5d24))
* renames reducers to modes in interactionManager ([7275dd3](https://github.com/molikas/axoview/commit/7275dd3a230ea84033eb7bd9874054bf7e01aedd))
* revert few changes ([44cd5f0](https://github.com/molikas/axoview/commit/44cd5f0c6c8041a197dfc1bf136874722ef50972))
* simplifies dev by removing animations (for now) ([cbe7249](https://github.com/molikas/axoview/commit/cbe7249c15367b1b66023e7c8464349f77a27b64))
* simplifies how zooming & scrolling is applied ([bfce0b4](https://github.com/molikas/axoview/commit/bfce0b48e5b64123d173b8a10d814e387dbd8ca5))
* simplifies interaction manager logic ([cfd8a5a](https://github.com/molikas/axoview/commit/cfd8a5ab5156816b423620883a1e916a995aa7e7))
* simplifies library exports and includes reducers as exports ([e7c79f0](https://github.com/molikas/axoview/commit/e7c79f0b9ba08877e3d4639c86e66f38e7a409d2))
* simplifies logic inside of onMouseEvent ([034a849](https://github.com/molikas/axoview/commit/034a8490e36c6df046c7164e26059f9d3f03a29d))
* simplifies renderer component ([0cb2446](https://github.com/molikas/axoview/commit/0cb2446b9ef75a4fe217fa332ef86555541b9860))
* unifies various ui states into single enum ([6a0a398](https://github.com/molikas/axoview/commit/6a0a3982b7a797e57c3d0abb1b39dbcf0f30cb2d))
* wraps item controls in UiElement component ([b069219](https://github.com/molikas/axoview/commit/b06921935dfd31f294f7c2acc9f409795e886ad4))

# Changelog

All notable changes to this fork are documented here.
For upstream FossFLOW history (pre-fork), see [docs/upstream-changelog.md](docs/upstream-changelog.md).

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/). Versioning uses a date-based scheme: `YYYY.M.D` — the version always reflects the date the release was cut from `master`. The live demo at [demo-fce.pages.dev](https://demo-fce.pages.dev/) always runs the latest version.

---

## [Unreleased]

---

## [2026.5.21] — 2026-05-19

### Added

- **Subtle brand mark in the top toolbar's LEFT zone.** 24px favicon SVG + `Axoview` wordmark using the splash style (weight 600, letter-spacing 0.02em, "Axo" in `#1f2937` + "view" in `#2563eb` accent). Non-interactive, does not compete with the canvas diagram name. Amends [ADR 0005](docs/adr/0005-toolbar-and-dock-layout-contract.md) which previously declared LEFT intentionally empty.
- **New Axoview brand icon set.** `favicon.svg` (vector source-of-truth) + raster sizes 96×96, 180×180 (apple-touch), 192×192, 512×512 (maskable PWA icons) shipped from `packages/axoview-app/public/`. `index.html` prefers SVG with a 96px PNG fallback; `manifest.json` exposes the full set for installable PWA contexts.

### Changed

- **Project renamed from FossFLOW to Axoview.** Public API symbols renamed: `Isoflow` → `Axoview`, `IsoflowProps` → `AxoviewProps`, `IsoflowRef` → `AxoviewRef`, `useIsoflow` → `useAxoview`. Workspace folders renamed `packages/fossflow-*` → `packages/axoview-*`. npm package name `fossflow` → `axoview`. Upstream lineage attribution (FossFLOW + Isoflow) preserved across README, LICENSE, and the in-app About tab. The `@isoflow/isopacks` icon-pack dependency is intentionally NOT renamed; icons remain attributed to Isoflow.
- **Backwards-compatible importer for legacy FossFLOW project ZIPs.** New exports write `format: "axoview-project"`; the importer accepts both `axoview-project` and `fossflow-project` manifests. Filenames change from `fossflow-*.zip` to `axoview-*.zip` for new exports.
- **One-shot localStorage migration shim.** On first boot after upgrade, keys with `fossflow_*` / `fossflow-*` prefixes are copied to the `axoview_*` equivalents (without overwriting existing keys) and the originals deleted. Runs at most once per browser profile, gated by `axoview_migration_v1`. `window.__fossflow__` remains as an alias for `window.__axoview__` with a one-time deprecation warning; will be removed in two releases.

### Removed

- **Legacy FossFLOW raster icons.** `favicon.ico`, `logo192.png`, `logo512.png` deleted from `packages/axoview-app/public/`. Modern browsers fall back cleanly through the SVG → 96px PNG chain; the auto-`/favicon.ico` 404 is already in the e2e console-error ignore list.

---

## [2026.5.20] — 2026-05-19

### Added

- **Inline splash screen on page load.** White-background splash with the *FossFLOW* wordmark (slate `#1f2937` + brand-blue `#2563eb` accent) and a CSS-only ring spinner is rendered directly in `public/index.html`, so it appears at the browser's first paint (~500 ms) instead of after the JS bundle has parsed (~2.5–4 s in session mode). `App.tsx` fades it out and removes it from the DOM after the editor's first paint via two `requestAnimationFrame` ticks. Replaces the prior white-screen gap. No React component required — survives bundle-parse, storage probe, and React mount.

### Performance

- **Storage init probes parallelised + 800 ms timeout cap.** `AppStorageProvider` was awaiting `fetchRuntimeConfig()` then `manager.initialize()` sequentially; switched to `Promise.all` (both probes are independent — see [architecture.md §2l](docs/architecture.md#2l-fossflow-app-provider-decomposition-2026-04-27)). Per-probe `AbortSignal.timeout` dropped from **5000 ms → 800 ms** in `useRuntimeConfig.ts` and `LocalStorageProvider.isAvailable()`. Why 800 ms: a healthy backend answers in <50 ms (docker measured ~45 ms each); when the backend is absent, Chrome/Windows can spend ~2.3 s on a dual-stack connect probe before reporting `ERR_CONNECTION_REFUSED` to JS, and the app-level timeout cuts that short. Measured impact on session-mode cold start (no backend on `:3001`): storage init **2700 ms → 800 ms**, end-to-end FCP **7100 ms → 540 ms** (splash visible), editor-canvas-mounted **7100 ms → ~4000 ms** (bundle parse is now the dominant cost).

### Fixed

- **`reportWebVitals` repaired for web-vitals v5 API.** Pre-existing breakage — the file imported `getCLS / getFID / getFCP / getLCP / getTTFB`, but v3+ renamed them to `onCLS / onFCP / onLCP / onTTFB` and removed FID in favour of INP. The call was previously dormant because `reportWebVitals()` was invoked without an argument and the `instanceof Function` guard skipped the broken import; the bug only surfaced once a callback was passed. Now imports `onCLS / onFCP / onINP / onLCP / onTTFB`.
- **`UiOverlay` no longer triggers `Invalid prop children supplied to ForwardRef(Box)` in dev.** Two `createPortal(...)` expressions sat as children of an outer positioning `<Box>`; MUI's `PropTypes.node` check rejects `ReactPortal` because its `$$typeof` is `react.portal` (not `react.element`). Hoisted both portals out of the `<Box>` to siblings inside the wrapping fragment — portals render into their target node regardless of JSX position, so behavior is unchanged. Dev-only warning; never affected production builds (PropTypes are stripped).

### Tests

- **3 new app-side suites pinning the startup-perf invariants** (5 new tests + jsdom polyfill): `hooks/__tests__/useRuntimeConfig.test.ts` (rejection fallback, 800 ms `AbortSignal` abort, singleton cache), `services/storage/__tests__/LocalStorageProvider.test.ts` extended for `isAvailable()` hanging-fetch timeout, `providers/__tests__/AppStorageContext.test.tsx` (render-based parallel-probes pin — total init ≈ max not sum). `jest.setup.js` polyfills `AbortSignal.timeout` for jsdom 20 which ships an AbortSignal missing the static method.

---

## [2026.5.19] — 2026-05-19

### Changed

- **Newly-loaded icon categories auto-expand + pulse (MQA #10).** When the user toggles on an isopack from the Elements panel's *"Add more icons"* loader (or a swapped diagram brings new categories with it), the freshly-arrived category accordion now auto-expands and its header runs a 1.6s soft pulse (≈18% primary-color alpha) so the user notices that the icons actually arrived. First-paint behavior is intentionally unchanged — large packs (>100 icons) still default to collapsed on the initial bulk load to avoid rendering thousands of tiles before the user has scrolled anywhere. New transient `freshlyLoadedCategoryIds` slice in `uiStateStore`, populated by `useInitialDataManager.load()` only when prior categories existed (incremental signal), cleared 1.8s after the pulse via `ElementsPanel` effect. The `LARGE_PACK_THRESHOLD` size guard now applies to first-load only; on incremental loads the `PREVIEW_COUNT = 60` cap in `IconCollection` is the render guard.

---

## [2026.5.18] — 2026-05-18

### Added

- **Multi-element selection contract (MQA #8 + #9, ADR-0006).** New `selectedIds: ItemReference[]` slice in `uiStateStore` is the single source of truth for canvas multi-selection. Invariant: when `length === 1`, `itemControls` mirrors it (panel opens); when 0 or > 1, `itemControls` is null (panel auto-hides — heterogeneous selections aren't editable as a group). Gestures: **Ctrl/⌘+click** toggles items in/out (Figma/Sketch standard); **Ctrl/⌘+A** selects every visible + unlocked item in the active view (respects [§4.3](docs/ux-principles.md#43-locked--hidden-layer-items-are-non-interactive--across-every-selection-path) lock/hide gates); **Esc** clears multi-selection when no other dismiss target; **Delete** removes every selected item including waypoint anchors. Lasso / freehand-lasso mirror their finalised selection into `selectedIds` so multi-select persists outside lasso mode. Drag any one of the selected items → whole group moves together. New `TransformControlsManager` renders an outline per item when `length > 1` (no resize anchors — bulk transform deferred). Bottom-dock left zone shows a `"N selected"` chip (primary color, anchors future bulk-action UI). Full contract in [ADR-0006](docs/adr/0006-canvas-selection-contract.md).
- **Waypoint Alt+click removes the waypoint without removing the connector.** Direct gesture, no menu — right-click was already overloaded by `rightClickPan` + `NodeActionBar`. Endpoints stay intact (they're required for the connector). Plain click + drag on a waypoint still repositions it. Waypoint visuals also bumped (10px circle was 8, with a clearly-visible accent-colored diamond inside); the hit area extends to a 32px transparent ring around the visual so clicks within the larger ring also register. Cursor changes to pointing-finger on hover, and a 600ms-delayed tooltip surfaces the *"Alt+click to remove"* hint. DOM-driven `data-anchor-id` lookup replaces fragile tile-equality matching so clicks anywhere in the ring resolve to the right anchor at any zoom.
- **`tooltipWithShortcut` helper for canvas controls (MQA #19).** Shared helper at `packages/fossflow-lib/src/utils/tooltipWithShortcut.ts` formats `label (KEY)` strings. Adopted by `ToolMenu`, `BottomDock` (Help → *"Help (F1)"*), `ZoomControls` (zoom +/- → *"(Wheel ↑/↓)"*), `LeftDock` (Elements → *"Elements (E)"* / *"Elements (N)"* depending on the active hotkey profile).
- **Icon import: AI-prompt affordance in the Elements panel.** Sparkles ([`AutoAwesomeOutlined`](https://mui.com/material-ui/material-icons/?query=auto+awesome)) icon next to "Import Icons" opens a popover with a literal isometric-icon LLM prompt and a Copy-to-clipboard button. Prompt body intentionally not i18n'd (it's content the user pastes verbatim into an external tool); affordance text exists in all 12 locales. mqa-results.md #28.
- **Delete imported icons with workspace-wide usage warning (MQA #26).** Hover an imported icon tile in the Elements panel → red × badge top-right (top-right is the universal convention — Chrome tabs, Figma variants, VS Code workspace items, tag chips). Clicking opens a confirm dialog that scans every diagram in the workspace and lists each one that references the icon with a per-diagram count, before deletion. Items whose icon id no longer resolves render a faded dashed-square **tombstone placeholder** so canvas layout stays stable; re-importing under the same id resurrects affected items automatically. Built-in catalog + isopack icons are never deletable (their × never renders) — isopack management stays in Settings → Icon Packs. New `iconUsageScan` injection prop on `<Isoflow>` (lib) lets the app inject the workspace scan; the PWA implements it in [`services/iconUsage.ts`](packages/fossflow-app/src/services/iconUsage.ts) via `StorageProvider.listDiagrams() + loadDiagram(id)`, preferring the in-memory active diagram so unsaved edits count. Falls back to a current-diagram-only scan when no callback is wired (tests, stripped embeds). Delete pushes a history entry so `Ctrl+Z` restores the icon and un-tombstones items. See [ADR-0002 Lifecycle](docs/adr/0002-icon-catalog-merge-on-load.md).

### Changed

- **Settings dialog redesigned with a left vertical rail (MQA #20).** Top tabs (which scrolled horizontally once all 7 panels were present) replaced with a 200 px left rail in VS Code Settings style. A divider separates user-facing tabs (Keyboard shortcuts · Canvas · Connectors · Icon packs · Language) from the "geeky tail" (About · Diagnostics). Dialog now has a stable 60vh / min-480 height so switching tabs no longer reflows. Per-panel duplicate `<h6>` titles dropped — the rail label is the title. Canvas tab gains internal `Section` headers for Zoom and Labels. `settings.hotkeys.title` renamed *"Hotkey Settings"* → *"Keyboard shortcuts"* in en-US (other locales unchanged — value tweak, not a new key per [§7.1](docs/ux-principles.md#71-all-ui-strings-go-through-locales)).
- **`assignLayerToItems` filters waypoint refs before dispatch.** When a lasso captures a connector with waypoints, the "Assign layer" affordance now strips the `CONNECTOR_ANCHOR` refs before calling the layer reducer — waypoints aren't independently assignable to a layer. Previously the menu existed but did nothing for connector-bearing selections.
- **LassoLayerBar counter-scales with zoom.** Mirrors the [NodeActionBar pattern (§8.8)](docs/ux-principles.md#88-canvas-anchored-chrome-is-screen-pixel-stable) — direct DOM ref + `uiStoreApi.subscribe` on zoom, bypasses React render. Bar stays at natural pixel size at any zoom.
- **Floating action bar opens on right-click only.** Left-clicking a node / connector / rectangle / text-box now only sets selection — the floating `NodeActionBar` no longer appears unless the user right-clicks the item. Adds `itemActionBarOpen` to `uiStateStore`; `setItemControls` resets it on selection change so re-selecting another item doesn't carry the bar over. mqa-results.md #1.
- **Lock + hide layers now enforce non-interaction across every selection path.** `isItemInteractable` (built in `useInteractionManager` from `lockedIds` + `visibleIds`) gates direct-click selection (`Cursor.mousedown`), marquee selection (`Lasso.getItemsInBounds`), freehand selection (`FreehandLasso.getItemsInFreehandBounds`), and right-click context-menu. Previously only `lockedIds` was checked and only at direct-click — lasso freely scooped up locked and hidden items. Locked rows now also get a warning-colored left accent stripe + tinted background + saturated lock icon so the state is unmistakable. Layers panel rows remain the escape hatch for selecting hidden/locked items. mqa-results.md #2.
- **F2 renames the selected layer in the Layers panel.** Mirrors the file-explorer F2 pattern via a document-level `keydown` listener gated on focus being inside the panel or on `body` (so the file-explorer's own F2 stays authoritative when its container is focused). Edit state is lifted out of `LayerRow` so it can be triggered externally. mqa-results.md #3 / #15.
- **Layers panel always shows the "Unassigned" section.** Previously hidden when no unassigned items existed — left users with no drop target to pull items back out of a layer. Empty state shows a dashed-outline drop hint; dragging onto the section unassigns the item. mqa-results.md #4.
- **Folder explorer + Layers panel toolbar icons are hover-revealed (VS Code style).** Icons sit at `opacity: 0` and fade in (`120ms ease`) on container `:hover` / `:focus-within`. Keep their DOM space so layout doesn't reflow. Applies to file-explorer (new diagram/folder, import, export, refresh, collapse) and Layers (add layer, delete selected). mqa-results.md #27.
- **Storage-gauge label drops to `0.75em`.** Documented inline as a typography-contract exception so future sweeps don't normalise it back. mqa-results.md #6.
- **Share-link popover Copy button is sentence-case.** Explicit `textTransform: 'none'` override — the `AppToolbar` lives outside the lib's `ThemeProvider` scope so it would otherwise inherit MUI's default uppercase Buttons. mqa-results.md #23.
- **Page (view) count hard-capped at 5.** Interim guard until the tab-overflow UX is rebuilt — the "+" button disables with an "Page limit reached (5)" tooltip beyond the cap. See [known_issues.md](known_issues.md). Page-overflow scroll/redesign deferred. mqa-results.md follow-up 2026-05-15.
- **Preview-mode interaction redesigned (MQA #22 + #25).** In `EXPLORABLE_READONLY`: default cursor is `default` (right-drag pans, matching the canvas); left-click on a node with clickable content opens the readOnly `NodePanel` via `Pan.mouseup` and the cursor flips to `pointer` on hover. Panel header is the node name itself rendered as a clickable link when `headerLink` is set (URL surfaces via tooltip); body adds a new "Linked diagram" section showing the resolved diagram name as a clickable link, or an explicit `Cannot resolve linked diagram with id: <id>` error when the target is missing. Removed the prior icon-based header affordances. mqa-results.md #22 / #25.
- **Diagram rename now mirrors into the per-diagram blob (session mode).** `LocalStorageProvider.renameDiagram` updates both the diagrams listing and `blob.title` / `blob.name` so project export captures the new name even for diagrams that weren't reopened post-rename. mqa-results.md #14.
- **F2 inline-rename in the file explorer ignores keystrokes outside the renderer.** Lib's window-level keydown handler now scopes the F2 → `inlineEditNodeName` dispatch to events originating inside the renderer, so a canvas-selected item no longer steals focus from the file-explorer's edit input. mqa-results.md #13.
- **Delete-diagram resets the canvas (MQA #18).** New `notifyDiagramDeletedFromTree(id)` on `DiagramLifecycleProvider` cancels pending autosave, drops the scratch buffer, clears the active diagram ref, and reloads a blank scene. Wired into both `FileExplorer` and `DiagramManager` delete flows so the autosave can't recreate the just-deleted diagram.
- **Delete-folder now sweeps orphan diagrams (backend).** `deleteFolder` (Express adapter) removes every `diagrams/<id>.json` whose `folderId` pointed at any deleted folder, plus any associated `public/<shareUuid>` snapshots. Closes the gap that left orphaned diagrams visible in `listDiagrams` after a folder delete.

### Fixed

- **MQA #5 — connector redo now restores the connection.** The scene-store undo was recomputing the future-stack entry via `produceWithPatches(currentScene, draft => Object.assign(draft, applyPatches(currentScene, entry.inversePatches)))`, which yielded patches in the **wrong direction** (B → A, an undo). On redo, those undo-direction patches applied to an already-undone state were a no-op — model.redo correctly restored `views[].connectors` but `scene.connectors[id]` stayed empty (no path → invisible connector), and the future entry was still consumed (redo button disabled). Scene store now mirrors model store: push the **original** entry to future on undo; pop and re-apply forward on redo. Load-bearing invariant — see [docs/architecture.md §7](docs/architecture.md).
- **MQA #5 (secondary) — right-click "Add connection" undo collapses to one step.** `NodeActionBar.handleStartConnector` now wraps `createConnector` with `beginDragTransaction` / `commitDragTransaction` so the entire create + drag + commit lifecycle lands as a single history entry (matched the palette-tool drag path which was already correct).
- **MQA #5 (defensive) — no-op `set()` no longer clobbers the redo stack.** Both `modelStore.set` and `sceneStore.set` short-circuit when the computed patches array is empty: state still applies but the past/future arrays are left untouched. Originally fixed the "no-op selection write between two redos drops the trailing entry" class.
- **MQA #12 — `1. <space>` at the start of an empty rich-edit line no longer erases the input.** Override Quill's `list autofill` keyboard binding with a noop handler that returns true (literal space inserted, autofill never replaces the line with an empty `<ol>`). Toolbar buttons remain the canonical way to start a list.
- **MQA #14 — diagram rename now persists into project export.** See Changed entry above (session-mode blob mirror).
- **MQA #14 (follow-up) — import after folder delete no longer 409s.** `importProject` strips the original `id` from each model blob before calling `createDiagram`, so the server allocates a fresh id and orphaned-id collisions can't abort the import. Pairs with the backend orphan sweep above.
- **MQA #16 — node-edit deck stays open when text drag-select crosses its edge.** `Cursor.mouseup` ignores mouseups whose drag started outside the renderer (no canvas-side mousedown registered + `mode.mousedownHandled === false`). Panel only dismisses on a genuine canvas click.
- **MQA #18 — autosave can no longer resurrect a deleted current diagram.** See Changed entry above.
- **MQA #21 — Docker folder create + project import no longer fail.** Three cooperating fixes in `packages/fossflow-backend/src/routes.js`: (1) `createFolder` / `createDiagram` use random-suffix ids (`folder_${Date.now().toString(36)}_${rand}`) with a collision retry, so back-to-back sequential creates from the SPA can't collide on `Date.now()`. (2) `readFolders` coerces legacy `{ folders: [...] }` payloads (and other unexpected shapes) into a flat array so the fs adapter survives an out-of-shape `folders.json` from an earlier code version. (3) Both adapters log unexpected shapes once so legacy files surface in production logs.
- **MQA #22 — duplicate "Open in new tab" tooltip in preview mode.** Removed the inner badge-level `<Tooltip>`; the outer node-body tooltip covers the badge area. Superseded by the broader #22 / #25 redesign above (passive badge now non-interactive; click goes to the panel).
- **MQA #24 — share-link no longer leaks the backend port.** New `shareUrlFromUuid(uuid)` helper builds the URL from `window.location.origin` instead of trusting the server's `req.get('host')` (which returned `:3001` when the SPA was on `:3000`). Used by `AppToolbar`, `DiagramManager`, and the file-explorer share action.
- **DiagnosticsOverlay scene counts (`ni` / `nc` / `ntb`) now report real values.** Two cooperating fixes: `Isoflow.tsx` exposes `window.__fossflow__` whenever `NODE_ENV !== 'production'` (in addition to the existing `enableDebugTools` opt-in) — previously absent in normal dev builds because the app never passes the prop, so the overlay's store reads always returned zero. And `getSceneCounts` in `DiagnosticsOverlay.tsx` now reads the active view's `items.length` and `connectors.length` (via `ui.view`) instead of the model item catalog (which is the icon library, not placed nodes). Companion fix to MQA #7 — without these, post-fix perf profiles couldn't correlate FPS with scene complexity.

### Performance

- **MQA #7 — multi-element drag FPS cliff eliminated.** Drag of 6+ selected nodes used to drop from 60 fps to 9–13 fps for 12–19 seconds at a time, recovering only after a major GC. Three-stage architectural fix: (1) `bba712c` wrapped `DragItems` in `beginDragTransaction` / `commitDragTransaction` matching the connector-drag pattern from `7164b3b`, collapsing per-tick history pushes and skipping `produceWithPatches` while pendingPre is frozen; (2) `728b229` split `Node` into a thin position shell + memoized `NodeContent`, replaced inline `sx={{left, top}}` with module-level sx constants + inline `style`, and switched `useScene()` → `useSceneActions()` inside `NodeContent` to break a shallow `views` subscription that was firing every drag frame; (3) `7e09fba` (Path 4-true) introduced CSS-only drag preview — items and free-floating waypoint anchors no longer write to the model per frame; visual updates are pure DOM CSS-variable mutations on `data-drag-id` elements, connector geometry is recomputed via a new `scene.previewConnectorPaths(itemPreview, anchorPreview)` action that writes straight to `scene.connectors[].path`, and `flushSync` keeps Connector subscribers in lockstep with the CSS mutations. Final tile values commit to the model on mouseup via `batchUpdateViewItemTiles` + per-connector `scene.updateConnector`; the drag transaction collapses everything into one history entry. **Result:** sub-13fps cliff eliminated entirely; sustained 24–44 fps throughout the drag. Trade-off: `view.items[].tile` and `view.connectors[].anchors[].ref.tile` are stale during a drag — see [docs/architecture.md §1 Drag Items](docs/architecture.md#1-feature-inventory) and [docs/perf-troubleshooting.md](docs/perf-troubleshooting.md) for the full invariant. Also fixes a long-standing Lasso bug where waypoint anchors weren't pushed into the selection when both endpoint items were in lasso bounds.
- **Render-probe diagnostic harness (`useRenderProbe`).** Gated behind `?perfprobe=1`; zero cost when off. Already wired into `Nodes` / `Node` / `NodeContent` / `Connectors` / `Connector`. Console API: `window.__fossflowRenderProbe.start() / stop() / dump()`. Built for the MQA #7 investigation and kept as durable infrastructure for the next perf round.

### Removed

- **Dead `quickIconChange` dispatcher (MQA #19 cleanup).** `useInteractionManager` bound the `I` key to dispatch a `quickIconChange` CustomEvent that had no listeners anywhere — leftover from before the Elements side-panel replaced the in-canvas quick-icon flow. Both the dispatch and the key binding removed; `I` is now free for `ijklPan` without conflict.
- **Per-panel duplicate `<h6>` titles in Settings.** `HotkeySettings`, `PanSettings`, `ConnectorSettings`, `IconPackSettings` each rendered their own `<Typography variant="h6">{title}</Typography>` at the top, restating the tab label. Dropped — the new left rail label is the title (MQA #20).
- **Export Compact JSON, entirely (MQA #17).** Compact serialiser, `transformToCompactFormat` / `transformFromCompactFormat` / `exportAsCompactJSON`, public re-exports (`packages/fossflow-lib/src/index.ts`), MainMenu entry, ExportPopover entry, file-explorer context-menu entry, `DiagramManager` load-side back-compat path, jest mock, `isoflowProps` type field, and the `exportCompactJson` i18n key across all 12 locales. The compact format was lossy (rectangles, text, connector labels, color, style, notes were all dropped) and never worth keeping alongside the full JSON export.

### Tests

- **`multiSelect.contract`** — 6 store-level tests pinning the ADR-0006 invariant: `setSelectedIds([])` clears both slices; `setSelectedIds([single])` opens the panel for that item; `setSelectedIds([>1])` hides the panel (MQA #9 auto-hide); `toggleSelected` adds-when-absent / removes-when-present and re-opens the panel on count → 1; `clearSelection`; and `setItemControls(single)` keeping `selectedIds` coherent for the layer-row click path.
- **`utils/connectorSelection`** — 8 unit tests pinning the helpers that encode the connector-with-waypoints selection contract: `getConnectorWaypointRefs` (returns CONNECTOR_ANCHOR refs only for tile-bound middle anchors), `countUserFacingRefs` (waypoints don't inflate the badge), `filterUserFacingRefs` (drops waypoint refs for assign-to-layer dispatch).
- **`Cursor.waypointGestures`** — 6 mode-action regression tests for the MQA #8/#9 + waypoint-removal gestures: Alt+click splice removes the clicked waypoint; subsequent mouseup preserves the connector selection (no spurious `clearSelection` via the `altSpliceConsumed` flag); plain click (no Alt) still sets up drag; DOM-driven `targetAnchorId` lookup wins over tile-equality so off-tile clicks within the 32 px hit ring still resolve; Ctrl+click on a connector toggles connector + waypoints as one group (add when absent, remove all when present).
- **`connector.createUndoRedo`** — real-store regression exercising the full begin/createConnector/updateConnector×N/commit/undo path; asserts both stores' `canRedo()` return true and that the connector reappears after redo. Pins the MQA #5 root-cause fix.
- **`Pan.modes`** — adds EXPLORABLE_READONLY cursor (default vs grab), mousedown-no-grabbing-in-preview, and body-click-opens-panel-for-any-content-bearing-node assertions.
- **`node.linkTooltipDedup`** — repinned for the final design: header name-as-link testid, LINKED DIAGRAM body section testids (resolved link + unresolved error), absence of the old icon-based header affordances, no `OpenInNewIcon` import.
- **`f2.rendererScope`** — pins the F2 → `inlineEditNodeName` renderer-scope guard (#13).
- **Lib-side `RichTextEditor.formats`** — extended to pin the `list autofill` noop-handler override (#12).
- **App-side regressions** — new `shareUrl.test.ts` (origin-anchored share URL), `LocalStorageProvider.test.ts` rename-mirrors-blob, `delete.contract.test.ts` (Provider + FileExplorer + DiagramManager call order for #18), `backendRoutes.contract.test.ts` (random-suffix id pattern + collision-retry loop for #21).
- **`DragItems.modes` (MQA #7 Path 4-true)** — 6 new assertions pinning the CSS-preview contract: entry/exit/mouseup open and commit `beginDragTransaction`; mousemove does NOT call `scene.transaction` or `scene.updateConnector` for node-only or waypoint drags (route is `previewConnectorPaths` with both item and anchor preview maps); mouseup commits items via `batchUpdateViewItemTiles` and waypoints via per-connector `scene.updateConnector`; rare anchor RECONNECT path (no `initialTiles[anchorId]`) still flows through `scene.transaction`.

---

## [2026.5.11] — 2026-05-10

### Added

- **Typography contract — six tiers, theme-driven.** [`theme.ts`](packages/fossflow-lib/src/styles/theme.ts) now defines `h6 / body1 / body2 / caption / overline / micro` with explicit roles (dialog title / dialog body / primary readable lists / sub-labels / region wayfinding / glanceable status). Custom `micro` variant registered via TypeScript module augmentation. Component-level overrides (`MuiTab`, `MuiChip`, `MuiInputBase`, `MuiFormControlLabel`) live in the theme — no per-component `fontSize`/`fontWeight`. `overline` is sentence case + tracked (NOT uppercase) to honor §1.2 / §7.2. See [docs/ux-principles.md §1.5](docs/ux-principles.md).
- **"Add more icons" accordion in the Elements panel.** Pack-loader buttons + Import Icons collapsed into a single accordion (closed by default) — gives the icon grid back its full vertical real estate without losing the affordances. Sentence-case title; uppercase removed.
- **Layers panel: Shift-click range / Ctrl-click toggle multi-select.** Routes through canvas LASSO mode so the existing floating action bar and canvas highlights work for free. Bounding tiles computed from scene data so the action bar positions correctly above panel-driven selections. Anchor row is the last plain-clicked item; ephemeral panel state, not stored.
- **Import validation surfaces to the user.** Schema-failed diagram loads now push a `severity: 'error'` notification with the first 1–2 zod issues summarised, alongside the existing `console.error`. New UX principle §6.3 codifies this for any future user-triggered failure path.
- **`Export Project (.zip)` in the Export popover.** Folded into the toolbar Export menu alongside Export JSON / Compact JSON / Image. `setShowProjectExport` hoisted into `useDiagramLifecycle` so the trigger lives next to the other export actions.

### Changed

- **NodeActionBar stays at natural pixel size at every zoom.** Counter-scales the SceneLayer transform via direct DOM ref with `1 / zoom` (was `Math.min(1, 1/zoom)` — bar shrunk on zoom-out). Pattern documented in new UX principle §8.8 for any future canvas-anchored chrome.
- **QuickIconSelector — parity with Elements panel.** Replaced the bespoke `TextField` with the shared `Searchbox` component, routed filtering through `useIconFiltering`, dropped the `helpBrowse` / `helpSearch` footer and the `searchPlaceholder` key. Recently-Used and keyboard navigation (Arrow / Enter / Escape) preserved.
- **Save / Load / Export / Confirm dialogs — MUI body, sentence case.** Rewrote `SaveDialog` / `LoadDialog` / `ExportDialog` from the legacy `<div className="dialog">` HTML to MUI `Dialog + DialogTitle + DialogContent`. Deleted dead `SaveAsDialog.tsx` and the matching CSS. Dropped `fontWeight={600}` on `h6` titles — theme owns typography weight now.
- **SessionModeBanner — quieter, dismiss-only.** `background.paper` background + 4 px `warning.main` accent stripe + caption typography (was a full warning-tinted bar). Export button removed (now in the toolbar Export popover); only the dismiss × remains. Dismissal persists in `localStorage['fossflow-session-banner-dismissed']`.
- **`Session` chip + storage gauge — less prominent.** Chip height reverted from 18 → 16, padding tightened to 0.5, `micro` variant `fontWeight` 600 → 500. The literal `"SESSION"` is now `"Session"` (sentence case per §1.2). Gauge chip same shrink — keeps its dynamic warning/error filled state.
- **Layers panel rows — match file explorer styling.** Item row text color flipped from `text.secondary` to `text.primary`; icon thumbnail no longer dimmed at `opacity: 0.7`. Selected state still uses `primary.contrastText`. Both panels now read as the same family.
- **Connector additional-label "Text" input.** Replaced the floating MUI `label="Text"` with an external `caption` Typography label + `size="small"` TextField — matches the Position / Height offset / Font size pattern in the same card.
- **Region/dock headers — sentence case.** `Diagrams` (was `DIAGRAMS`), `Layers`, `Common`, `Unassigned`, icon-pack collection names, etc. all render via the `overline` variant in sentence case. Uppercase styling came from a per-component CSS transform; removed in favour of role-driven typography. Honors UX §1.2 / §7.2.

### Tests

- **`quickIconSelector.i18n.test.ts`** — refreshed contract: search input is the shared `Searchbox`, help footer dropped, `searchPlaceholder` / `helpSearch` / `helpBrowse` keys removed from `quickIconSelector` namespace.
- **DebugUtils snapshots** — re-baselined after theme changes (only emotion-generated CSS class hashes shifted; visual content identical).

### Known issues

- **i18n: "Add more icons" accordion title / orphan keys not translated outside en-US.** Two new entries in [`known_issues.md`](known_issues.md). Backfill the `iconSelectionControls.addMoreIcons` key in 13 non-English locales; strip the obsolete `quickIconSelector.searchPlaceholder` / `helpSearch` / `helpBrowse` keys from those same files. Functionally harmless (English fallback renders the key); cosmetic cleanup.
- **`leanSave.test.ts` — 1 pre-existing failing assertion.** `mergeBundledFixtures (ADR 0002) › overridden default wins…` reads `bundledFixtures[0].id` but the fixtures source is empty (predates the 2026-05 shake-out). Recorded in `known_issues.md`. Runtime path is unaffected (`iconPackManager` supplies real packs).

---

## [2026.5.10] — 2026-05-10

### Performance

- **Connector drag — collapsed history entries.** Each tile crossed during a connector drag (or anchor reconnect) used to push a separate history entry, computing patches across the entire model per tick. Now wrapped in a `beginDragTransaction` / `commitDragTransaction` pair on the scene store — one entry per drag. Implementation: `pendingPreFrozen` flag on both `modelStore` and `sceneStore` keeps the pre-drag snapshot alive across intermediate `set()` calls; commit triggers a single patch computation. Side benefit — `Ctrl+Z` after a drag rewinds the whole drag, not one tile at a time.
- **Closed-form connector router.** Replaced A\* over an always-empty `PF.Grid` (in [`utils/pathfinder.ts`](packages/fossflow-lib/src/utils/pathfinder.ts)) with a deterministic diagonal-then-orthogonal walker. The grid had no obstacles, so A\* was searching for an answer geometry already determines. Removes the per-tick `Grid` + `Node` object allocation churn that produced a constant 100→200 MB GC sawtooth during sustained interaction. Original symptom (FPS dropping to 2–10 fps within seconds of drag start) is gone; first ~50 s of drag now holds 60 fps on the perf-stress fixture.

### Tests

- **`connector.dragPerf.test.tsx`** — 4 perf-regression tests against the real provider stack: drag transaction collapses N tile updates into 1 history entry; baseline (no transaction) still pushes N entries; `pendingPre` stays alive across intermediate ticks; 40-tick drag completes under 1500 ms (currently ~37 ms). The fixture is loaded from disk and `modelSchema.safeParse`d on test setup so the manual import file can't drift out of schema.
- **`packages/fossflow-e2e/fixtures/perf-stress-diagram.json`** — heavy importable scene (80 nodes, 120 connectors, two named anchors at opposite ends of the canvas). Compact single-line JSON, schema-valid, regenerated from [`perf-stress-diagram.generator.mjs`](packages/fossflow-e2e/fixtures/perf-stress-diagram.generator.mjs). Shared between manual stress tests and the automated perf regression — single source of truth.

### Known issues

- **Sustained connector drag (≳50 s) still hits a GC cliff.** Per-tile model immer clones (~12 MB/sec on the stress fixture) accumulate to ~336 MB before V8 fires a stop-the-world collection, producing a 5-second 4-fps stall. Doesn't affect typical use (drag from A to B = 5–10 s). Refactor design context — including the two-reader invariant, files in the hot path, and the deferred `previewAnchors` approach — captured in [`known_issues.md`](known_issues.md) for a future session.

### Added

- **Toolbar and dock layout contract (ADR 0005).** Top toolbar collapses to a single RIGHT zone with four named groups separated by dividers, ordered left → right: View modes (reserved slot — buttons land here in future ADRs), Save group (Save button in session mode + StatusCluster), Document actions (Export / Share / Preview), Sidebar toggle (Properties panel portal). LEFT and CENTER zones are intentionally empty — diagram name continues to live on the canvas. See [ADR 0005](docs/adr/0005-toolbar-and-dock-layout-contract.md).
- **Left strip absorbs File Explorer and Settings.** Two regions (Navigation `📁` / Working `⊞ ≣`) plus a system anchor (`⚙ Settings`) at the bottom. The 📁 toggle moved out of the top toolbar; ⚙ replaces the deleted burger Settings item. Elements / Layers stay mutex; `📁 + ⊞` (or `📁 + ≣`) co-occur as before.
- **Settings dialog gains About and Diagnostics tabs.** *About:* GitHub link + version. *Diagnostics:* debug-overlay toggle (drives `useUiStateStore.actions.setEnableDebugTools`), Download model JSON, Download session dump (re-homed from the SessionStorageGauge popover — gauge keeps its per-diagram breakdown).
- **`ExportPopover` in toolbar Group 3** — single ⬇ button with a popover offering Export JSON / Export Compact JSON / Export Image. Replaces the three burger entries.
- **`StatusCluster` in toolbar Group 2** — bundles save state + (in session mode) the SESSION chip and storage gauge. Save button sits flush against it so the action and state read as one visual unit.
- **`MainMenuOptions` re-exported** from the lib's standalone exports so callers can type their `mainMenuOptions` prop without dipping into internal paths.
- **`disableLeftDockWorkingTabs` prop** on `<Isoflow>` — when no diagram is loaded, Elements and Layers icons are disabled with a "open or create a diagram first" tooltip. Avoids dead-end clicks on the empty state.

### Changed

- **Left-side panels overlay the canvas instead of pushing it.** File Explorer is now an absolute overlay sibling of `Isoflow` at `left: 40px`; Elements / Layers panel offsets to `left: 320px` when File Explorer is open so both can coexist with each panel's `borderRight` providing the visual seam. Canvas dimensions stay constant regardless of which panels are open. Aligns with the existing rule for the right Properties panel.
- **No slide animation on left-side panels.** All left-side panels (File Explorer, Elements, Layers) appear and disappear instantly. The previous behaviour was inconsistent — File Explorer never animated; Elements / Layers slid via `transform`/`transition`. Snapping removes the inconsistency and the layout-jump that switching between panel types produced.
- **`StatusCluster` simplified — no orange wrapper.** The SESSION chip alone signals the mode; the tinted box around the cluster was redundant. Saved-text only renders when there is something to say (no more empty `<span>` placeholder).
- **`EmptyStateScreen` confined to the canvas region.** Now positioned at `top: 0, left: 40, right: 0, bottom: 40` instead of `inset: 0`. The left strip (40 px) and BottomDock (40 px) stay visually uncovered, so the chrome is visible on first load even before a diagram exists. Removed the legacy `.fossflow-container > div { height: 100% }` rule that was overriding inline `bottom` positioning on overlay siblings.
- **BottomDock + LeftDock strip raised to `zIndex: 20`.** Belt-and-suspenders against future overlay collisions; the geometric exclusion above is the load-bearing fix.

### Fixed

- **Empty state no longer hides the toolbars.** Root cause: `Isoflow`'s outer `Box` uses `transform: translateZ(0)` which creates a new stacking context, trapping the strip's `zIndex: 20` inside it; externally `Isoflow` ranked at `auto` and lost to `EmptyStateScreen`'s `zIndex: 5`. Geometric fix (above) is robust against this without depending on z-index across the boundary.
- **`ExportPopover`** dropped the inner `<Paper>` wrap (`Popover` already wraps via `PaperProps`).
- **`DiagnosticsTab`** stray `exportAsJSON(model as any)` cast removed — `modelFromModelStore` already returns `Model`.
- **`AboutTab`** GitHub link opens with `noopener,noreferrer`.
- **`AppToolbar`** dead `dirtyDiagramIds` / `multiDirtyCount` removed; Save tooltip simplified.
- **`MAIN_MENU_OPTIONS` typed correctly.** `never[]` (semantically the impossible array) → `MainMenuOptions`.

### Removed

- **Burger menu in the app chrome.** Lib's `MainMenu` is still exported for other consumers; the app simply stops portaling it. Items redistributed per ADR 0005: New / Open / Clear → file explorer; Export* → toolbar Export popover; Settings → strip ⚙; GitHub + Version → Settings → About.

---

## [2026.5.9] — 2026-05-09

### Added

- **Connector as a first-class peer of nodes.** `name`, `notes`, `headerLink`, `showLabel` fields added to `connectorSchema`. Synthetic name label rendered at the connector midpoint on the canvas; F2 inline rename reuses `inlineEditNodeName`. Name label becomes a clickable link when `headerLink` is set (`OpenInNew` overlay). `ConnectorControls` restructured into Details / Style / Notes tabs matching `NodePanel` shape. See [ADR 0004](docs/adr/0004-connector-name-and-details-panel.md).
- **`name` field on TextBox and Rectangle.** Both schemas gain `name: z.string().max(200).optional()`. `RectangleControls` and `TextBoxControls` add a Name section (sentence-case label, `Element name…` placeholder). Layer-tree shows the name when set, falling back to `content` (text box) or `'Rectangle'`.
- **Layers-panel F2 rename for `TEXTBOX` and `RECTANGLE`** (was `ITEM`/`CONNECTOR` only). `LayerItemRow` `RENAMEABLE` set extended; `handleItemRename` wires `updateTextBox` / `updateRectangle`.
- **Polymorphic floating action bar.** `NodeActionBar` now handles all four item types: `ITEM`, `CONNECTOR`, `TEXTBOX`, `RECTANGLE`. Per-type delete (`deleteViewItem` / `deleteConnector` / `deleteTextBox` / `deleteRectangle`) and per-type panel events (`nodePanel` / `connectorPanel` / `textBoxPanel` / `rectanglePanel`). Connector tile threaded through `ItemControls` (`Cursor.ts`) so the bar positions above the click point — connectors have no intrinsic tile.
- **Connector width slider — 5 stops** (10 / 15 / 20 / 25 / 30) instead of 3 (10 / 20 / 30). Same range, finer resolution; existing diagrams unchanged because all previous values still align to marks.
- **`ConfirmDialog` Enter-to-confirm** keyboard shortcut at the dialog level.
- **`LayerItemRow` icon thumbnails for ITEM rows.** Other types use 16 px glyphs.
- **Layer name-label toggle.** Eye icon swaps `LabelOutlined` / `LabelOffOutlined` (semantically *item name visibility*, not layer visibility — see [docs/ux-principles.md §2.2](docs/ux-principles.md)). Opacity 0.5 at rest, 1 on hover; wired on both the layer-group and unassigned render sites.
- **`EmptyStateScreen` Import card.** Direct import path for empty trees; `ImportDialog` opens for non-empty trees so existing diagrams aren't silently overwritten. Post-import auto-opens the file explorer with a success notification. `onCreate` / `onImport` cards rendered side-by-side.
- **`refreshFileTree`** exposed from `DiagramLifecycleProvider`.
- **Locale namespace expansion** across all 14 locales: `connectorControls` (name, color, width, lineStyle, lineType, useCustomColor, showArrow, solid/dotted/dashed, singleLine/doubleLine/doubleLineWithCircle, addLabel, noLabels, showName/hideName); `nodePanel` showName/hideName; `textBoxControls` and `rectangleControls` `name` + `namePlaceholder`.
- **`docs/ux-principles.md`** — living design language reference covering Section as the layout primitive, sentence-case-everywhere, half-opacity affordances, F2 rename universally, two-way panel/canvas sync, item-type parity, icon semantics, and localisation rules. Referenced by `/feature`, `/shake-out`, `/audit`, `/notes`.
- **ADR 0004** — connector name and details panel.

### Changed

- **Sentence-case sweep across all property panels.** `Section` component dropped `textTransform: uppercase`; now `caption` + semibold + secondary color, sentence case throughout (Node / Connector / TextBox / Rectangle). Material-Design-2014 ALL CAPS legacy retired.
- **`ConnectorLabels` filter** fixed to include name-only connectors (was the root cause of missing canvas labels for connectors with `name` but no legacy `description`).
- **Default zoom 75 % → 65 %** for more breathing room on initial load.

### Fixed

- **Connector Style: width slider at max no longer triggers a horizontal scrollbar.** Root cause: MUI Slider thumb's invisible 42 × 42 `::after` hit-area pseudo-element extends ~21 px past the slider's right edge at `left: 100 %`; combined with `TabPanel`'s `overflowY: 'auto'` (which CSS-spec-converts `overflow-x: visible` → `auto`), this triggered a horizontal scrollbar. Fix: `overflowX: 'hidden'` on `TabPanel` in both `ConnectorControls` and `NodePanel`. The hit-area is invisible — clipping it has no visual or interaction cost.
- **Layer eye toggle** — `onToggleLabel` handler was missing on the unassigned render site; now wired alongside the layer-group site.

### Tests

- No new test files this release. Test count and suite count unchanged.

---

## [2026.5.3] — 2026-05-03

### Added

- **Phase 5* — Cloudflare + Docker dual-target deployment.** Single `/api/*` HTTP contract served by Express+filesystem (Docker) and Hono+R2 (Cloudflare Pages Functions). New `packages/fossflow-worker/` package and `functions/api/[[path]].ts` bridge. Frontend is byte-identical at the network boundary across targets.
- **Runtime config endpoint** — `GET /api/config` replaces build-time env injection. New `useRuntimeConfig` hook + `apiBaseUrl()` helper consolidate three inline copies.
- **Public-snapshot share model** — `POST /api/diagrams/:id/share` publishes an immutable snapshot at `/api/public/diagrams/:uuid` (read bypasses auth); `DELETE` unpublishes.
- **Project zip workspace bundle** (ADR 0001) — import/export the full workspace as a single `.zip` (manifest + `diagrams/<id>.json` + tree-manifest). New `projectZip.ts`, `ExportDialog`, `ImportDialog` components. Destination picker on import (Merge into root / New folder / Replace all with typed-confirm).
- **Lean icon save** (ADR 0003) — every write path strips default-catalog icons; load-time merge in `useInitialDataManager` rehydrates them (ADR 0002). New `leanSave.ts` helper.
- **`requiredPacks: string[]`** persisted alongside lean icons so importers know which icon packs to lazy-load. `loadPacksForDiagram` now reads `data.requiredPacks` (with an items × icons fallback for non-lean payloads).
- **Session storage gauge** in the file-explorer header — chip leads with `%` (e.g. `<1% · 3.6 KB`); click for per-diagram breakdown popover. Color thresholds at 60% / 90%.
- **Session-mode banner** appears when storage resolves to session and ≥1 diagram exists; dismissable per session.
- **File-explorer Import / Export-project toolbar buttons.**
- **Per-diagram and per-folder Export…** entries in the tree context menu.
- **Per-diagram export split** into three flat actions — *Export as image…* (delegates to lib's rich `ExportImageDialog`, auto-opens the diagram if needed), *Export as JSON*, *Export as compact JSON* (both download directly, no dialog).
- **Inline rename on canvas** — F2 with a node or text-box selected, or double-click on its label, enters inline-edit on the canvas via a contentEditable Typography that auto-grows rightward.
- **File-tree rename via F2 + context menu** (double-click rename tracked in [known_issues.md](known_issues.md) with workaround).
- **`sessionWorkUnexported` flag** drives the `beforeunload` prompt without overloading `hasUnsavedChanges`; clears only on successful project-zip export.
- **Image export available in session mode** (server-storage gate dropped).
- **Public lib exports** — `exportAsJSON`, `exportAsCompactJSON`, `DialogTypeEnum`, `IsoflowRef.openExportImageDialog()` so callers outside the Isoflow provider tree can trigger the dialog.
- **Default new-view name `"Page 1"`** (was `"Untitled view"`).
- **ADRs 0001-0003** — durable architectural decisions for project zip format, icon catalog merge contract, and lean icon save.
- **Tactical doc convention** — `docs/tactical/<topic>.md` for short-lived implementation plans, deleted after work merges.
- **`/feature` skill** — bootstraps new features against the ADR + tactical convention.

### Changed

- **Burger menu trimmed** to Settings · GitHub · Version. "Clear the canvas" item deleted.
- **Toolbar [Ctrl+O] folder icon removed** (duplicate of file-explorer toggle); Save in session mode now wires through `flushAutoSave()`.
- **Import dialog wording** rewritten in user vocabulary: "At the top — keep the original folder layout" / "Inside a new folder" / "Replace all existing folders and diagrams". Lead row now shows the contents summary instead of the raw filename.
- **Cloudflare runtime is storage-less** — R2 dropped from the Worker and both `wrangler.toml` files. `/api/config` reports `serverStorage: false`; SPA falls back to session/localStorage. Persistent storage on Cloudflare will return via the Drive provider on a separate branch.
- **Env names standardized** to `AUTH_SHARED_SECRET` / `CF_ACCESS_TEAM_DOMAIN`.
- **Auth bypass** for `/api/config` and `/api/storage/status` so the SPA can boot under `shared-token` mode.
- **Node 20 baseline** (`.nvmrc` bumped from 16); npm-only (`packageManager: npm@10.9.2`); `yarn.lock` removed (Cloudflare Pages was auto-detecting yarn 4 from a stale lockfile).
- **`fossflow-app` prebuild** chains the lib build so Cloudflare Pages' `--workspace=packages/fossflow-app` invocation still resolves the workspace dependency.

### Removed

- `S3Provider` storage stub and `@aws-sdk/*` + `minio` dependencies (Phase 3C dropped).
- Legacy `storageService.ts` and dead `r2Adapter` shim.
- Phantom `Icon1` / `Icon2` fixture stubs from `packages/fossflow-lib/src/fixtures/icons.ts` (real catalog comes from `@isoflow/isopacks`).
- `CONTRIBUTING.md`, `.github/PULL_REQUEST_TEMPLATE.md` — fork doesn't accept code PRs.
- `FOSSFLOW_ENCYCLOPEDIA.md` — superseded by [docs/architecture.md](docs/architecture.md).
- `docs/SEMANTIC_RELEASE.md` — upstream's auto-release pipeline is no longer used.
- 9 localized README mirrors under `docs/README.*.md` — were upstream translations only.

### Fixed

- **2D mode: rectangle resize handles** align to the actual square corners (was hitting iso-diamond outer points via `BOTTOM/RIGHT/TOP/LEFT` `TileOrigin` offsets).
- **2D mode: `TransformAnchor`** renders as an upright rounded square (was rotated to iso diamond by the unconditional iso CSS matrix).
- **2D mode: `NonIsometricIcon`** renders flat at the tile center (was hardcoded to the iso projection wrapper, leaving AWS/GCP/Azure/K8s/MUI icons visually tilted in 2D).
- **Icon-pack auto-load on diagram import** — `loadPacksForDiagram` was a silent no-op because it tried `item.icon?.collection` on a string id; now reads `data.requiredPacks` with an items × icons fallback.
- **Session-mode autosave preserves `folderId`** — the autosave model from `handleModelUpdated` strips `folderId`, so `LocalStorageProvider.sessionSaveDiagram` now falls back to the existing meta's value instead of relocating the diagram to root on every autosave.
- **Inline rename commits empty string** — clearing the canvas label now propagates to the store and hides it (was silently discarded).
- **JSON export filename uses the diagram title** (slugified, with a short `YYYYMMDD-HHmm` suffix). `ImportDialog` reads the suggested name from `data.title` / `data.name` / `data.t` (compact format), falling back to the filename only when no embedded title exists. JSON round-trip now preserves the diagram name.
- **Share-link context-menu entry hidden in session mode** — was a guaranteed failure path because the backend share endpoint isn't reachable.
- **Storage ID collisions** — `LocalStorageProvider` now appends a random suffix to ids (was `${prefix}_${Date.now()}`). Same-millisecond mints during project import caused folders to receive their own id as `parentId`, which the recursive `buildTree` walked forever (`Maximum call stack size exceeded`).
- **`leanIfModel` dictionary lookup** — switched to object-dictionary lookups instead of `Set` so target=es5 transpilation under ts-jest doesn't silently drop members.

### Security

- **Path-traversal blocked** via ID regex `^[a-zA-Z0-9_-]{1,64}$`.
- **CSP + Helmet + 10 MB body limit.**
- **Auth modes** — `none` / `shared-token` (constant-time compare) / `cf-access` (full JWKS RS256 verify on Worker; rejected on Express).
- **Drive API scope locked down** to `drive.file` (deferred until the Drive provider lands).

### Tests

- New: `leanSave.test.ts` (round-trip strip + preservation contract for already-lean inputs); `services/project/__tests__/projectZip.test.ts` (round-trip, replace-all confirmation, malformed zip, unknown version); 3 regression tests for `requiredPacks` derivation/preservation; `LocalStorageProvider` cases for unique-id minting and session-save folderId preservation.

---

## [2026-04-27] — Phase refactor (0A → 2C)

Seven-commit structural expansion covering provider decomposition, a notification system, 2D canvas mode, the Material icon pack, a pluggable storage interface, a VS Code-style file explorer, and cross-diagram links. All 353 regression tests pass.

### Added

- **Phase 0A — App.tsx decomposition into providers.** `AppStorageContext` (storage init, `isServerStorage`, `isInitialized`) and `DiagramLifecycleProvider` (all diagram state, save/load/delete, keyboard shortcuts, `beforeunload` guard, icon-pack manager, dialog wiring) extracted. `App.tsx` slimmed from 744 → 103 lines (pure provider composition). `AppToolbar` drops every prop in favour of `useAppStorage` / `useDiagramLifecycle` hooks.
- **Phase 0B — Notification system.** `notificationStore` (Zustand, not persisted) with `push` / `dismiss` / `dismissAll` replaces every `alert()` call. `NotificationStack` (MUI Snackbar+Alert, max 3 visible, FIFO queue). `ConfirmDialog` — promise-returning dialog for destructive-action confirmation.
- **Phase 1A — 2D canvas mode.** `CoordinateTransformStrategy` pattern: ISO and Cartesian2D strategies each encapsulate `toScreen`, `fromScreen`, and `gridTileUrl`. `CanvasModeContext` provides the active strategy plus bound helper functions. `canvasMode` (`'ISOMETRIC' | '2D'`) added to persisted `uiStateStore` settings. New `grid-tile-2d.svg` square grid asset. `Grid.tsx`, `useIsoProjection`, `Node.tsx`, and `getMouse` are mode-aware. 2D / ISO toggle in ToolMenu; auto fit-to-view on switch.
- **Phase 1B — Material Icons pack.** `scripts/generateMaterialIconPack.js` (prebuild) generates a `material-icons-pack.json` with ~2,179 icons from `@mui/icons-material`. Registered as `'material'` alongside aws/gcp/azure/k8s. Large packs (>100 icons) render a 60-icon preview. `iconCategoriesState` preserved across pack reloads; newly loaded packs auto-expand. DiagnosticsOverlay moved into `BottomDock` `endSlot` via `bottomDockEnd` prop. Default zoom 85% → 75%. `preserveViewport` flag on `IsoflowRef.load()`.
- **Phase 2A — Pluggable storage interface (local provider).** `StorageManager` provider registry. `LocalStorageProvider`: server-backed when reachable, falls back to `sessionStorage`. Full folder CRUD + tree-manifest support. `GoogleDriveProvider` `NotImplementedError` stub. Backend folder CRUD, move, soft-delete patch, and tree-manifest endpoints.
- **Phase 2B + 2B-R — VS Code-style file explorer.** Collapsible 280 px left panel using `react-arborist`. Pushes the canvas rather than overlaying it. Full CRUD with `__pending__` node pattern, drag-and-drop with collision detection, duplicate, hard delete. Auto-sort folders → diagrams alphabetically. Dirty indicators on nodes and ancestor folders. `EmptyStateScreen` — full canvas replacement when server storage is available and no diagram is open. `checkUnsavedBeforeNavigate` guard for session-mode dirty state. Dialog standardization (elevation-8, `borderRadius: 2`, X close button).
- **Phase 2C — Diagram-to-diagram links + welcome popup on empty state.** A node can link to another diagram. In `EXPLORABLE_READONLY`, clicking opens the target in a new tab with a tooltip *"Opens 'X' in a new tab"*. Blue badge on the icon indicates the link. "Copy share link" item in the file-tree right-click menu. `LazyLoadingWelcomeNotification` uses `createPortal(document.body)` to escape the CSS transform stacking context.

### Removed

- Auto-draft creation, `DraftsSection`, `TrashSection`, `AppToolbar` "New diagram" button.
- All contextual tip overlays from `UiOverlay` (`ConnectorHintTooltip`, `ConnectorEmptySpaceTooltip`, `ConnectorRerouteTooltip`, `LassoHintTooltip`, `ImportHintTooltip`).

### Fixed

- Inline rename loses focus — MUI Menu `disableRestoreFocus` + 150 ms delay.
- Duplicate diagram 409 — copied data strips `id` before POST.
- First-load hint blink — `isInitialized` guard before canvas render.
- Connector drawing regression — `MAIN_MENU_OPTIONS` lifted to module-level constant so `setEditorMode` no longer resets tool mode on every context re-render.
- 2D mode cursor off by 3.5 tiles — root cause was the ISO formula running in 2D `getMouse`; fixed by threading `screenToTile` from `CanvasModeContext`.
- TDZ crash on init — keyboard-shortcut effect ordered after `handleSaveClick` / `handleOpenClick` declarations.

### Tests

- New: `coordinateTransforms.test.ts` (22 cases, 1 skipped); `notificationStore.test.ts` (10); `LocalStorageProvider` (9); generator-script (5).
- Updated: `saveTracking.isAfterLoad` rebased onto `DiagramLifecycleProvider`; `SizeIndicator.test` wrapped in `CanvasModeProvider`. SVG file mock added.

---

## [2026-04-10] — UX & Editor

### Added

- **New diagram** — Hamburger menu gains a "New diagram" item. Pending edits show a three-button guard dialog: *Save & continue* (autosaves to `localStorage`, falls back to JSON download), *Discard changes*, *Cancel*. Tab-close fires a native browser warning when edits are unsaved.
- **Connector — single-shot from Elements panel.** Connector card draws one connection then returns to the cursor tool. Toolbar Connector button keeps its persistent mode.
- **Import Icons dialog** — Isometric toggle moved from a persistent checkbox into a per-import confirm dialog (default: flat).

### Changed

- **Rectangle renamed from Group** — Double-click popover and Elements panel card now say "Rectangle". All 13 locale files updated. Internal mode types unchanged.
- **ToolMenu cleanup** — Rectangle and Text removed from the top toolbar (both accessible from the Elements panel).

### Fixed

- **Flat icon elevation** — Non-isometric icons were rendered ~41 px too high. `NonIsometricIcon` was applying a negative `top` offset before the iso matrix transform. Fixed by anchoring at `top: 0`.

---

## [2026-04-08] — Default zoom 85%

### Changed

- Default zoom reduced from 90% → 85% for slightly more breathing room on load.

---

## [2026-04-07] — Architecture refactoring

Six-phase structural cleanup — no feature changes, no library changes. 392 tests pass; zero production TypeScript errors. Architecture health score: **4.9 → 7.4 / 10**.

### Changed

- **`renderer.ts` split** (866 → ~210 lines): `utils/isoMath.ts` (coordinate math), `utils/hitDetection.ts` (spatial index), `utils/renderer.ts` (screen-space helpers + barrel re-exports).
- **`useScene.ts` split** (697 → 13 lines): `useSceneData.ts` (read selectors), `useSceneActions.ts` (write ops + transaction machinery), `useScene.ts` (combiner, external API unchanged).
- **Clipboard context:** `ClipboardProvider` replaces the module-level singleton — each `<Isoflow>` instance gets its own clipboard with no cross-instance bleed.
- **Settings persistence:** user preferences (`hotkeyProfile`, pan/zoom/label settings, connector mode) now survive page reload via `localStorage`.
- **Types:** `types/settings.ts` is the canonical home for all settings types; config files re-export from there.

### Security

- `window.__fossflow__` gated behind `enableDebugTools` prop.
- Unroutable connectors now show a dashed-red canvas indicator + `console.warn` instead of being silent ghost elements.

---

## [2026-04-06] — Internationalisation complete + ExportImageDialog fix

### Added

- **Full UI localisation** in both packages.
  - `fossflow-app` (react-i18next, `app` namespace): toolbar buttons (Save / Load / Diagrams / Share), Preview tooltip (3 states), Share popover, Save As dialog, Save-status label (`formatSavedAt()` with interpolation), Diagrams Manager (title, badges, "Last modified", empty state, share/delete tooltips, error messages).
  - `fossflow-lib` (localeStore, TS locale files): ToolMenu tooltips (`toolMenu` namespace, all 13 locales) and QuickIconSelector (`quickIconSelector` namespace) wired through `t()`. Lib's `t()` does not support object params — `.replace()` used for interpolation.
- **Language selector** shows the active language's display name (e.g. "中文 (简体)") instead of the generic "A/文" glyph.
- **All 11 non-English JSON files** updated with the new keys.

### Fixed

- **`zh-CN.ts viewTabs`** — `addPage`, `deletePage`, `renameDiagram` were English placeholders; corrected to Chinese.
- **ExportImageDialog blank preview on first open** — `exportImage()` was called after a fixed 100 ms timeout + double `requestAnimationFrame`, which fired before the hidden Isoflow had populated its model store. The hidden Isoflow now receives `onModelUpdated={handleHiddenIsoflowReady}`; on the first call, `isoflowReadySignal` is incremented and a dedicated effect fires a single `requestAnimationFrame` to export. A separate options-change effect is guarded by `isoflowLoadedRef.current`. Both call `exportImage` through a stable `exportImageRef`.

### Tests

- New: `exportImageDialog.initialLoad.test.ts` (8); `i18n.localeCompleteness.test.ts` (asserts every top-level namespace from `en-US.ts` is present in all 13 locale files); `toolMenu.i18n.test.ts` (11); `quickIconSelector.i18n.test.ts` (12).
- Test count: 683 → 729; 68 → 72 suites; all passing.

---

## [2026-03-31] — Performance (9 optimizations + paste async)

Nine targeted optimizations, all measured with the in-app DiagnosticsOverlay.

### Performance

- **History (Fix 5)** — `modelStore` and `sceneStore` history switched from full-snapshot arrays to Immer `produceWithPatches` patch pairs. Memory for a 50-entry undo stack drops from O(N × 50 × model_size) to O(50 × diff_size). Undo/redo apply/invert the stored diff.
- **Async A* pathfinding (Fix 6)** — Connector routing dequeued out of the paste transaction into `requestAnimationFrame` batches of 25. Eliminates the main-thread block that triggered Chrome's "page is unresponsive" dialog at ~1 000+ connectors. Progress toast for pastes ≥ 500 connectors.
- **Per-connector sceneStore subscription (Fix A)** — Each `<Connector>` subscribes only to its own path slice with reference equality. Async path writes re-render only the one connector that received its route.
- **A\* LRU cache (Fix B)** — Path results cached in a 2 000-entry `Map` keyed by `from,to,gridSize`.
- **`startTransition` on paste (Fix C)** — Wraps `scene.pasteItems` in React's `startTransition` so the resulting render is deprioritised.
- **WeakMap item index (Fix 1)** — `useModelItem` and `getItemAtTile` build a `Map<id, item>` once per unique array reference via a module-level `WeakMap` — O(1) lookup, GC'd automatically.
- **`findNearestUnoccupiedTile` rewrite (Fix 2)** — Builds a `Set<"x,y">` of occupied tiles once; eliminates the O(N) `getItemAtTile` call inside every ring step.
- **Zustand transaction batching (Fix 3)** — `scene.transaction()` buffers intermediate states in a `pendingStateRef`, flushes as two `setState` calls at the end instead of 2 × N writes.
- **Viewport culling (Fix 4)** — `Renderer.tsx` computes tile-space bounds via `storeApi.subscribe()` (no React re-renders on pan/zoom unless the visible tile range actually changes). Items and connectors outside the viewport are filtered before render.

**Outcome.** On an ~113-node / 441-connector paste, FPS stays at 60 (previously froze to 5). On ~280-node / 1 132-connector paste, routing completes in ~9 s in background with no freeze (previously a hard main-thread block).

### Tests

- Fixed 4 test failures introduced by the perf refactors: `renderer.test.ts` mock updated for `hitConnectors`; `useHistory.realStore.test.tsx` redo round-trip; `useScene.listShape.test.tsx` and `useScene.referenceStability.test.tsx` updated to reflect that DEFAULTS merging moved from the list into `<Connector>`.

---

## [2026-03-30] — Code quality & security

### Added

- **Static analysis pipeline** — ESLint (flat config, v10), Knip (dead code / unused exports), and `npm audit` configured at root. Reports output to `reports/`.
- **Code coverage infrastructure** — Jest with Istanbul (via `ts-jest`); thresholds at 10% global minimums; HTML report in `packages/fossflow-lib/coverage/`.

### Removed

- **14 dead files** identified by Knip: `EditorPage.tsx`, `minimalIcons.ts`, `usePersistedDiagram.ts`, `NodeControls.tsx`, `NodeSettings.tsx`, `Header.tsx`, `useWindowUtils.ts`, `RichTextEditor/index.ts`, `index-docker.tsx`, `service-worker.js`, and 4 stale docs-config files.
- Unused imports: `Slider`, `Typography`, `Divider`, `FormControlLabel`, `CoordsUtils`, `IconPackName`, `mergeDiagramData`, `extractSavableData`.

### Fixed

- **Conditional hooks bug (Connector.tsx)** — `useIsoProjection` and 7 `useMemo` calls were invoked after an early `if (!color) return null` guard — a Rules of Hooks violation. All hooks now called unconditionally.
- **Stale closure (useCopyPaste)** — `showNotification` was a plain function re-created each render, so `handleCopy` / `handleCut` / `handlePaste` closed over a stale reference. Wrapped in `useCallback([uiStateApi])`.
- **Locale type completeness** — `addNodeGroupAction` / `Shortcut` / `Description` added to `LocaleProps` and all 11 non-English locale files.
- **Operational `console.log`** stripped from `useInitialDataManager`.

### Security

- **CVE patches** — `npm audit fix` resolved a path-to-regexp ReDoS (high) and a yaml stack-overflow (moderate).
- **Quill XSS** (high) documented as accepted risk — fixing requires a breaking downgrade of `react-quill-new`.

---

## [2026-03-29] — Node panel 3-tab redesign + MUI toolbar

### Added

- **Node panel — Details / Style / Notes tabs** — Replaced single-scroll accordion with a clean tab layout. *Details*: Name, Caption (rich-text shown on canvas), optional link. *Style*: Icon picker (inline), icon size, label font/color/height. *Notes*: full-height rich-text editor (~14 lines).
- **Caption vs Notes** — Former "Description" renamed to **Caption** (canvas-visible). **Notes** is private documentation. Both HTML rich-text, stored separately on `ModelItem`.
- **`notes` field on nodes** — `ModelItem` carries an optional `notes` rich-text field (HTML, no max length); Zod-validated. Backwards-compatible.
- **Floating action bar** — When a node is selected in editable mode, a compact pill bar appears above the node with five icon buttons: Style, Edit name, Link, Notes, Delete. Tracks the node as it scrolls and zooms.
- **Note indicator dot** — 14 px blue dot at icon top-right when `notes` is non-empty.
- **Read-only node panel** — In `EXPLORABLE_READONLY`, single-scroll panel with header (icon + name + optional link button) and **Caption** / **Notes** sections only when non-empty. Nodes with neither are not clickable.
- **Save & Preview button** — Eye icon in toolbar (edit mode). Silently saves first if dirty, then opens `/display/{id}` in a new tab. Tooltip adapts.
- **Double-click to add node or rectangle** — Double-clicking empty canvas opens a compact "Add" popover at the cursor with a **Rectangle** button at the top and an icon picker below.
- **MUI toolbar** — `fossflow-app` toolbar fully rewritten with MUI components. Custom Bootstrap-era CSS removed.

### Changed

- **Theme density** — `spacing: 6`, `fontSize: 14`, `borderRadius: 6`, global `size: 'small'` defaults.
- **Toolbar button hierarchy** — Save is `variant="contained"`; Diagrams and Share are `variant="outlined"`.
- **Help dialog** — "Add Node / Group — Double-click (empty area)" entry added.

### Fixed

- **Single left-click on empty canvas now just deselects** — context menu removed entirely (timer-based disambiguation with double-click was unreliable).
- **Lasso tool reverted to pointer on first click** — `mousedown` with no existing selection is now a no-op; `mousemove` builds the selection box.
- **Sporadic canvas drag — ghost image bug** — Browser `dragstart` on SVG/`<img>` was hijacking `mousemove`. Fixed by `preventDefault()` on `dragstart` on the renderer container.
- **aria-hidden focus warnings** in `MainMenu` and `QuickAddNodePopover` — focus restored/blurred before modal hides.
- **Build error (TAB_READONLY_NOTES)** — stale constant from read-only tab removal.
- **Pan.ts model not destructured** — `mouseup` referenced `model.items` without destructuring.

### Tests

- New: `dragStart.prevention.test.ts`, `quickAdd.groupButton.test.ts` (10).
- Updated: `Cursor.modes.test.ts`, `Lasso.modes.test.ts`, `toolMenu.propagation.test.tsx`, `saveTracking.isAfterLoad.test.ts`.
- Test count: 572 → 585; 59 → 61 suites.

---

## [2026-03-27] — Toolbar UX overhaul + save tracking

### Added

- **Toolbar UX overhaul** — 3-section layout: actions left, spacer center, language right. Three focused buttons: **Save** (direct save if associated, Save As for new diagrams), **Diagrams** (opens server or session dialog automatically), **Share** (copies read-only URL; disabled when no server storage or no saved diagram).
- **Save status tracking** — Save button disabled when no unsaved changes and a file is associated. Auto-save removed entirely; only explicit Save updates the last-saved timestamp.
- **Save status label** — Toolbar shows `Saved at HH:MM` / `Saved yesterday at HH:MM` / `Saved Mon DD at HH:MM` / `Saved Mon DD, YYYY at HH:MM`. A `•` dot appends when unsaved changes exist.
- **Save confirmation toast** — Brief `✓ [Name] saved` notification slides up from bottom-center, auto-dismisses after 2.5 s.
- **Diagrams manager** — Merged Load + Storage Manager into a single "Diagrams" button. Per-row share button copies a read-only URL.
- **Dismissible session warning banner** — Amber banner below the toolbar when running in session-only storage. Dismissed per tab via `sessionStorage`.
- **Community edition splash screen** — Welcome notification with community edition branding, fork repo link, GitHub issues prompt.

### Changed

- **Diagram title rename from canvas disabled** — ViewTabs title card is read-only. Page (view tab) names remain renameable inline.

### Fixed

- **Duplicate diagram title removed** — Title was shown in toolbar center and in ViewTabs; toolbar center title removed.
- **Multi-view save tracking** — Changes to any view (including creating a new view, adding nodes to view 2+) now correctly enable Save. Root cause: `isoflowRef.current.load()` triggered `onModelUpdated` → `hasUnsavedChanges=true`, then auto-save reset it 5 s later. Fixed with `isAfterLoadRef` pattern + removing `setHasUnsavedChanges(false)` from auto-save.
- **Undo/redo icon colors** — Were inverted. Fixed to industry norm: enabled=`grey.700`, disabled=`grey.400`, active=`grey.200`.
- **Language dropdown off-screen** — Was anchored `left:0`; fixed to `right:0`.
- **Old-format icon migration** — Diagrams saved before the full-icon-set format was introduced are silently re-saved on first load.
- **aria-hidden focus warning** — MUI context menu was setting `aria-hidden` on its modal root while a descendant still held focus. Focus moved back to the anchor before menu close.
- **Verbose logging** stripped from `storageService` and `App` — only errors remain.

### Tests

- New: `IconButton.color.test.tsx`, `viewTabs.titleReadonly.test.ts`, `splashScreen.communityEdition.test.ts`, `languageDropdown.positioning.test.ts`, `saveTracking.isAfterLoad.test.ts`.
- Test count: 545 → 572; 54 → 59 suites.

---

## [2026-03-25] — Cut + lasso bug fixes

### Added

- **Cut (`Ctrl+X`)** — Cuts selection to clipboard and removes it from the canvas. Supports full undo/redo: `Ctrl+Z` restores the deleted items while the clipboard retains the payload.

### Fixed

- **Node header link** — Clicking a node URL opens it in a new tab; bare URLs (e.g. `www.google.com`) normalised to `https://`.
- **Rectangle z-order after paste** — Pasting a stack of rectangles preserves the original visual layering.
- **Stacked rectangle hit-testing** — Clicking at a tile covered by multiple rectangles selects the visually topmost one.
- **Save as creates a new file** — Saving under a different name creates a new file instead of overwriting.
- **Connector waypoints move with lasso drag** — Tile-based mid-connector anchors now move with the selection during lasso/freehand-lasso drags.
- **Lasso drag when clicking on a node within selection** — Clicking on a node element inside a lasso selection correctly starts a group drag instead of redrawing the lasso.

### Tests

- `useCopyPaste.test.ts` 11 → 18; `keyboard.dispatch.test.tsx` 25 → 28; `shortcuts.test.ts` 6 → 7; `renderer.test.ts` +4; `Lasso.modes.test.ts` +3.
- Test count: 537 → 545. **Note:** E2E tests not currently passing — addressed separately.

---

## [2026-03-24] — Performance + connector label styling

### Added

- **Connector label font size** — Per-label slider (8–24 px) with companion position slider.
- **Connector label color** — Per-label text color picker with palette presets and custom input.
- **TextBox rich text editing** — Same Quill-based editor as node descriptions. Max content length 1000.
- **TextBox auto-height** — Text boxes expand downward to fit content.
- **TextBox text color** — Picker with palette presets, custom, and reset.
- **Node label color** — Canvas labels have a text color picker in the settings panel.
- **DiagnosticsOverlay** — Collapsible performance overlay (bottom-right). Live FPS, JS heap, long task count, item counts. Downloadable JSON. Always-on in dev; off by default in prod with `localStorage` toggle.

### Changed

- **Consistent color picker UI** — All label/text color pickers match the connector line color section.

### Performance

- **`onModelUpdated` double-fire fix** — Shallow equality on the model selector in `Isoflow.tsx`. Without it, every user action fired `onModelUpdated` twice → 6.4 long tasks/sec at idle. After: ~0/sec idle, consistent 60 fps.
- **`iconPackManager` prop churn fix** — Memoized in `App.tsx`. The inline object literal was recreated each render, causing a Zustand store write feedback loop.

### Tests

- `connector.test.ts` +6; `views.test.ts` +2; `textBox.test.ts` +2.
- Test count: 517 → 527.

---

## [2026-03-22] — Right-click pan + default zoom 90%

### Added

- **Right-click pan** — Single right-click deselects and dismisses item controls; right-click drag pans; releasing restores the previous tool. Gated by the existing `rightClickPan` setting.

### Changed

- **Default zoom 90%** — Canvas loads at 90% zoom for better initial framing. *(Later changed to 85% on 2026-04-08.)*

### Fixed

- **Node description empty-state** — Clearing all text from a node description correctly collapses the canvas label.
- **Service worker stale-build loop** — Replaced the legacy CRA service worker with a self-unregistering cleanup SW. FossFLOW is not a PWA.
- **StrictMode double-load** — Initial data effect fires only once per genuine prop change, not on React 18 StrictMode's double-mount.
- **Storage dev bypass** — Failed JSON parse + 5-second timeout on every dev reload caused by an env variable that was not statically inlined.

### Performance

- **Subscription tightening** — Zustand equality functions on mouse-state selectors; reactive subscription removed from `usePanHandlers`.
- **Grid off Zustand** — `Grid.tsx` reads scroll position via `useRef` + resize observer instead of Zustand.

### Tests

- `usePanHandlers.test.ts` 13 → 20.

---

## [2026-03-20] — Copy/paste toasts + settings consolidation

### Added

- **Copy/paste toasts** — Snackbar notifications for copy, paste, and empty-clipboard paste.
- **Connector mode indicator** — Toolbar shows a "Click" / "Drag" chip next to the Connector button.

### Changed

- **Settings consolidation** — Pan, Zoom, and Labels merged into a single "Canvas" tab — settings reduced from 6 tabs to 4.

### Fixed

- **Pan settings toggles inverted** — All 4 mouse-button pan toggles displayed inverted state.
- **Right-click context menu removed** — Right-click is reserved for pan.
- **Toolbar click triggering canvas actions** — Toolbar clicks could propagate to the interaction manager.
- **"Add Node" menu appearing on mode transitions** — Switching from Pan → Select incorrectly triggered the empty-canvas context menu.
- **Copy/paste centroid bug** — Centroid calculation now includes rectangles and text boxes.
- **Orphaned connector anchors on paste** — Connectors pasted without their anchored items have orphaned references cleanly detached.
- **Fixed shortcuts deduplicated** — `Ctrl+C/V/Z/Y` strings are a single source of truth in `src/config/shortcuts.ts`.
- **Zustand deprecated API warning** — Replaced `useStore(store, selector, equalityFn)` with `useStoreWithEqualityFn`.
- **Quill "bullet" format warning** — Removed unregistered `'bullet'` alias from RichTextEditor formats.
- **i18n short-code locale 404** — Added `load: 'currentOnly'` to i18next config.
- **`createModelItem` double-write** — Removed redundant `updateModelItem` call.

### Tests

- New: `toolMenu.propagation`, `Lasso.modes`, `Cursor.modes`, `connector`, `shortcuts.test`, `settings.defaults`, `uiOverlay.editorModes`, `modelItem`, `RichTextEditor.formats`, `zustand.deprecation`, `i18n.config`, `usePanHandlers`, `useCopyPaste`, `useHistory.realStore`, `connector schema`, `renderer`.
- Test count: 402 → 507; 54 suites.

---

## [2026-03-19] — Quill XSS pin + SVG export trim

### Security

- Pinned `react-quill-new` to avoid the Quill XSS vulnerability (GHSA-v3m3-f69x-jf25). The affected method (`getSemanticHTML()`) is not used by FossFLOW.

### Performance

- **SVG Export Optimizer** — Exported SVG size reduced ~20% (~940 kB → ~750 kB) by stripping irrelevant CSS, rounding float coordinates, and pruning `display:none` subtrees.

### Removed

- Unused dependencies from `fossflow-lib` (`auto-bind`, `paper`, `dom-to-image`, `react-hook-form`, `react-router-dom`, `recharts`, `css-loader`, `style-loader`).
- Bundle size: 3,438 kB → 3,403 kB (−35 kB).

---

## [2026-03-18] — Initial fork features baseline

### Added

- **Node header links** — Set a URL on any node to make its name a clickable link.
- **Diagram management** — Imperative diagram loading, multi-view management, diagram/view renaming.
- **Interaction controls** — Right-click pan, delete key, lasso selection, context menu restore.
- **Help dialog** — Updated to reflect all new interaction controls.

### Performance

- **Render cycle elimination** — Pan/zoom no longer triggers component re-renders. `memo` added to scene layer components.
- **Hotspot fixes** — Dependency stability, resize observer, RAF throttle CPU hotspots addressed.
- **Render isolation** — N-1 through N-5, H-3, M-1 hotspots eliminated.

### Tests

- Performance-refactoring regression baseline: 381 tests across 42 suites covering render isolation, dependency stability, RAF throttle, resize observer, and more.
