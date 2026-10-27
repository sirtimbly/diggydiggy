# Third-party notices

Diggy's original source code is licensed under the MIT license in `LICENSE`.
Dependencies and bundled fonts retain their upstream licenses.

- Dolt and the embedded Dolt Go driver: Apache License 2.0, reproduced in
  `local/licenses/Dolt-APACHE-2.0.txt`. See
  <https://github.com/dolthub/dolt> and <https://github.com/dolthub/driver>.
- DM Sans: SIL Open Font License 1.1, reproduced in `assets/OFL-dm-sans.txt`.
- Silkscreen: SIL Open Font License 1.1, reproduced in `assets/OFL-silkscreen.txt`.
- React, React DOM, Vite, and the remaining JavaScript and Go dependencies:
  consult their distributed license files and pinned dependency manifests.

When distributing compiled binaries, include the applicable dependency licenses
and notices, including native ICU libraries if bundled. Local builds currently
link against the machine's ICU installation.
