# Ledger: Coreutils Application Exempla

**Campaign**: [`CAMPAIGN.md`](CAMPAIGN.md)
**Parity contract**: [`parity-contract.md`](parity-contract.md)
**Opened**: 2026-07-06

## Column guide

| Column | Meaning |
| --- | --- |
| **Stage** | Campaign stage that owns first scheduling |
| **Stepper** | `—` not started · `slice` partial capability · `complete` all declared stepper fixtures green |
| **Ship** | `—` · `slice` · `complete` Tier A rust fixtures green |
| **Stepper surface** | Actions/flags intended for `lane = stepper` |
| **Blocked (stepper)** | File/host actions deferred to Stage 1b or `lane = rust` |
| **Next action** | Factory routing |

## Infrastructure

| Row | Stage | Stepper | Ship | Stepper surface | Blocked (stepper) | Next action |
| --- | --- | --- | --- | --- | --- | --- |
| `coreutils/` layout | 1 | complete | — | package workspace + fixtures | — | Complete |
| `scripta/check-coreutils-parity` | 1 | complete | — | stepper parity harness | rust milestone not exercised | Extend per utility |
| `common/gnu/*` substrate | 2 | complete | — | pure argv/stdio/format helpers | host I/O | Extend per utility |
| Inline `proba` package tests | 2 | slice | — | pure helper behavior in package `.fab` files | separate `.proba` discovery | Extend per utility |
| Package-mode kernel import resolution | 1b | complete | — | `norma:*` → stepper-kernel bridge in `--interpret`; file mutation/path verbs; scalar metadata; chmod mode setting; symbolic links; byte write | genus materialization for rich metadata; filesystem stats | Complete for Stage 5 scalar bridge helpers; richer host structs remain follow-on |
| `applications/` pointer exemplum | 1 | complete | — | meta only | — | Complete |

## Tier 0 — minimal host effects

| Utility | Stage | Stepper | Ship | Stepper surface | Blocked (stepper) | Next action |
| --- | --- | --- | --- | --- | --- | --- |
| `true` | 1 | complete | — | no-op, ignored args, exit 0; inline proba helper coverage | — | Rust ship milestone later |
| `false` | 1 | complete | — | no-op, ignored args, exit 1; inline proba helper coverage | — | Rust ship milestone later |
| `echo` | 2–3 | slice | — | operands joined by spaces, trailing newline, leading `-E` no-op, leading `-n` via `norma:consolum.dic`, leading `-e` for `\n`/`\t`/`\r`/`\\`; inline proba | remaining escapes, combined short opts | Continue remaining escapes/options or ship milestone |
| `yes` | 3 | slice | — | default `y`, custom operand, harness-capped stdout | infinite output termination | Continue operands or ship milestone |
| `pwd` | 3 | slice | — | logical cwd print | physical `-P` (Tier B) | Continue options or ship milestone |
| `basename` | 3 | slice | — | path operand, slash normalization, root/empty path, suffix operand, `-s`/`--suffix`, multiple paths with `-s` | missing/extra operand diagnostics, `-a`, `-z` | Continue diagnostics/options or ship milestone |
| `dirname` | 3 | slice | — | simple path operands, multiple operands, trailing slash, repeated slash before basename, root path | options, no-operand diagnostics, `//` implementation-defined root | Continue diagnostics/options or ship milestone |
| `printenv` | 3 | slice | — | set name operand via `norma:processus` | unset lookup (`lege` fails closed), full env dump | Continue optional lookup / ship milestone |
| `printf` | 3 | slice | — | plain text, raw no-newline output, `%%`, `%s`, repeated `%s`, `%b` basic escapes, plain `%d`/`%i` decimal integers with missing numeric argument as `0`, positive `%u`, positive `%o`, positive `%x`/`%X`, bounded positive `%f` with fixed-decimal rounding, bounded exponent-zero `%e`/`%E`, simple field width, string precision; inline proba formatting coverage | full exponent normalization, dynamic precision, usage diagnostics | Continue numeric formats/options or ship milestone |
| `seq` | 3 | slice | — | integer `LAST`, `FIRST LAST`, `FIRST INCREMENT LAST`, positive/negative increments, empty finite ranges, `-s SEP`, integer `-w`; inline proba range/format coverage | zero-increment diagnostics, invalid operand diagnostics, floats, `-f`, help/version, locale | Continue diagnostics/options or ship milestone |

## Stdin / text — stepper-friendly

| Utility | Stage | Stepper | Ship | Stepper surface | Blocked (stepper) | Next action |
| --- | --- | --- | --- | --- | --- | --- |
| `grep` | 4 | slice | — | stdin literal pattern, positional pattern, repeated `-e`, `-i`, `-v`, `-c`, `-n` for selected-line fixtures | regex semantics, no-match exit status, file operands, `-f`, `-r`, binary/context/color/diagnostics | Continue matcher/options/exit diagnostics or ship milestone |
| `wc` | 4 | slice | — | stdin default line/word/byte counts, `-l`, `-w`, `-c`, selected-count formatting | file operands, missing-final-newline byte parity, multibyte byte parity, diagnostics | Continue byte/diagnostics or ship milestone |
| `sort` | 4 | slice | — | stdin keyless ASCII line sort, duplicate/blank preservation, `-r`, `-u`, combined `-r -u`, `-f` with `-u`/`-r` fixtures | file operands, `-o`, key fields, non-default comparators, locale collation beyond ASCII fixtures, stable/merge/check modes, diagnostics | Continue options/diagnostics or ship milestone |
| `uniq` | 4 | slice | — | stdin adjacent duplicate filtering, separated repeats, `-c`, `-d`, `-u`, ASCII `-i` / `--ignore-case`, `-s N`, `-w N` | file operands, field skipping, locale-sensitive case folding, diagnostics | Continue comparison/options/diagnostics or ship milestone |
| `cut` | 4 | slice | — | stdin field mode, default tab delimiter, `-d` one ASCII delimiter, `-f` positive selectors/lists/ranges, no-delimiter passthrough, `-s`, `--complement` | byte/character modes, file operands, output delimiter, zero-terminated mode, diagnostics | Continue modes/options/diagnostics or ship milestone |
| `tr` | 4 | slice | — | stdin ASCII transliteration, `a-z`/`A-Z`/`0-9` ranges, repeated single replacement char, `-t`, `-d`, `-s` | complement, classes/equivalence, escapes, `-z`, diagnostics, multibyte semantics | Continue set/options/diagnostics or ship milestone |
| `fold` | 4 | slice | — | stdin default width 80, `-w N` positive widths, `-s` / `--spaces` ASCII wrapping, multiple newline-terminated ASCII lines | file operands, byte/column-exact folding, `-b`, tabs/backspaces, diagnostics | Continue width/options/diagnostics or ship milestone |
| `head` | 4 | slice | — | stdin default first 10 lines, `-n` non-negative counts, `-n -N` all-but-final-N line counts, EOF/empty stdin | file operands, `-c` bytes, invalid count diagnostics, `-n -0` spelling parity | Continue file/byte/diagnostics or ship milestone |
| `tail` | 4 | slice | — | stdin default last 10 lines, `-n` non-negative counts, `-n -N` explicit last-count form, `-n +N` one-based start-line form, EOF/empty stdin | file operands, `-c` bytes, `-f` follow, invalid count diagnostics | Continue file/byte/follow/diagnostics or ship milestone |
| `tac` | 4 | slice | — | stdin line reversal, empty/blank/repeated line preservation | file operands, custom separators, regex separators, before-mode behavior, diagnostics | Continue separators/options/diagnostics or ship milestone |
| `nl` | 4 | slice | — | stdin default non-empty line numbering, blank-line preservation, `-b a` / `--body-numbering=a`, `-v`, `-i`, `-w`, `-n ln` | file operands, logical pages, custom separators, other number formats, combined `-ba`, diagnostics | Continue formatting/options/diagnostics or ship milestone |
| `expand` | 4 | slice | — | stdin tab expansion, default stop 8, `-t N` positive integer stops, `-t A,B,...` finite absolute tab stops, `-i` / `--initial` leading-prefix mode | file operands, display-column semantics, diagnostics | Continue options/diagnostics or ship milestone |
| `unexpand` | 4 | slice | — | stdin leading-space compression, `-a`, `-t N` positive integer stops, `-t A,B,...` finite absolute tab stops | file operands, display-column semantics, subtle GNU tab-stop modes, diagnostics | Continue options/diagnostics or ship milestone |
| `tee` | 4 | slice | — | stdin stdout passthrough, blank-line preservation, `-a` no-file no-op | file outputs, append behavior with files, `-i`, byte-exact missing-final-newline behavior, diagnostics | Continue file-output/options/diagnostics or ship milestone |
| `comm` | 4 | slice | — | two sorted file operands, stdin `-` second file, `-1/-2/-3` suppress columns | diagnostics, locale collation | Continue options or ship milestone |
| `join` | 4 | slice | — | two sorted file operands, stdin `-` second file, default field-1 inner join | other join fields/options, diagnostics | Continue options or ship milestone |
| `paste` | 4 | slice | — | stdin single-stream passthrough, blank-line preservation, `-s` tab join, `-s -d` ASCII delimiter cycling, empty delimiter | multiple files/streams, delimiter escapes, `-z`, byte-exact missing-final-newline behavior, diagnostics | Continue streams/delimiters/diagnostics or ship milestone |
| `split` | 4 | slice | — | stdin `-l N` line chunks, default `x` prefix, `aa`/`ab`/… suffix files via `norma:solum.scribe` | file input, byte chunks, other options | Continue options or ship milestone |
| `od` | 4 | slice | — | stdin default `-t o2` octal dump, empty/single/multi-byte lines; `-t x1` byte-wise hex fixtures | file operands, address radix/options, other formats | Continue address/options or ship milestone |
| `cksum` | 4 | slice | — | stdin POSIX CRC + byte count, newline-terminated Tier A fixtures | file operands, other algorithms | Continue file/algorithms or ship milestone |

## Mixed — stdin slice first, file second

| Utility | Stage | Stepper | Ship | Stepper surface | Blocked (stepper) | Next action |
| --- | --- | --- | --- | --- | --- | --- |
| `cat` | 4–5 | slice | — | zero-operand line-oriented stdin concatenate, empty/blank/multi-line input; simple file operand line concatenate | options, byte-exact/missing-final-newline behavior | Continue options/byte-exact behavior or ship milestone |
| `test` / `[` | 5 | — | — | string/numeric tests; file predicates available through scalar solum helpers | richer diagnostics | Factory goal |
| `stat` | 5 | — | — | format strings (Tier B) | any path read | Rust-first or post-1b |
| `readlink` | 5 | slice | — | simple symlink target print via `norma:solum.sequere` | options, diagnostics | Continue options/diagnostics or ship milestone |
| `realpath` | 5 | slice | — | simple canonical path print via `norma:solum.absolve` | options, diagnostics, missing-path policy | Continue options/diagnostics or ship milestone |

## File / metadata — host-heavy

| Utility | Stage | Stepper | Ship | Stepper surface | Blocked (stepper) | Next action |
| --- | --- | --- | --- | --- | --- | --- |
| `ls` | 5 | — | — | `--help`, `--version` (smoke) | directory listing | After 1b or Rust ship |
| `chmod` | 5 | — | — | mode changes available through `norma:solum.modum` | diagnostics, symbolic mode parser | Factory goal |
| `mkdir` | 5 | slice | — | simple directory create; `-p` parent create | diagnostics, mode handling | Continue options/diagnostics or ship milestone |
| `touch` | 5 | slice | — | create empty file | timestamp options, no-create, diagnostics | Continue options/diagnostics or ship milestone |
| `cp` | 5 | slice | — | two-operand file copy | directories, multiple sources, preserve/options, diagnostics | Continue directories/options/diagnostics or ship milestone |
| `mv` | 5 | slice | — | two-operand rename/move | directories, multiple sources, overwrite/options, diagnostics | Continue directories/options/diagnostics or ship milestone |
| `rm` | 5 | slice | — | file remove; `-r` recursive directory remove | `-f`, interactive/safety options, diagnostics | Continue options/diagnostics or ship milestone |
| `ln` | 5 | — | — | symbolic links available through `norma:solum.vincula` | hard links intentionally deferred; diagnostics/options | Factory goal |
| `du` | 5 | — | — | — | disk usage | Ship lane |
| `df` | 5 | — | — | — | mount usage | Ship lane |

## System / info

| Utility | Stage | Stepper | Ship | Stepper surface | Blocked (stepper) | Next action |
| --- | --- | --- | --- | --- | --- | --- |
| `env` | 6 | — | — | print env, `VAR=val cmd` (subset) | full exec variants | Factory goal |
| `id` | 6 | — | — | uid/gid print (subset) | full groups | Factory goal |
| `whoami` | 6 | — | — | username | — | Factory goal |
| `uname` | 6 | — | — | `-s`, `-n`, `-r` | `-a` full | Factory goal |
| `date` | 6 | — | — | format subset | `-f`, `-r` file times | Factory goal |
| `timeout` | 6 | — | — | — | subprocess control | Ship lane |
| `sleep` | 6 | — | — | duration sleep | — | Factory goal |
| `nproc` | 6 | — | — | cpu count | — | Factory goal |

## Deferred

| Utility | Stage | Reason | Next action |
| --- | --- | --- | --- |
| `dd` | 7 | block I/O, signals, conv= | Defer |
| `install` | 7 | copy + mode + strip | Defer |
| `chroot` | 7 | privileged | Defer |
| `runcon` | 7 | SELinux | Defer |
| `mknod` | 7 | device nodes | Defer |
| `shred` | 7 | secure erase | Defer |
| `stty` | 7 | tty driver | Defer |
| `expr` | 7 | expression grammar breadth | Defer |
| `sha*sum` / `md5sum` | 7 | crypto surface breadth | Defer after `cksum` stdin |
| `factor` | 7 | arithmetic | Defer |
| `hostid` / `users` / `who` | 7 | legacy / utmp | Defer |
| `link` / `unlink` | 7 | syscall variants | Defer |
| `pathchk` | 7 | path portability | Defer |
| `sync` | 7 | fs sync | Defer |
| `vdir` / `dir` | 7 | `ls` variants | Defer with `ls` |
| `ptx` / `pr` / `fmt` | 7 | document formatting | Defer |
| `tsort` | 7 | topological sort | Defer |
| `chgrp` / `chown` | 7 | ownership | Defer with metadata track |
| `hostname` | 7 | no GNU coreutils baseline (moved to inetutils; not in brew coreutils) | Defer |
| `mkfifo` | 7 | special files | Defer |
| `dircolors` | 7 | terminal color db | Defer with `ls` |
| `logname` / `nice` / `nohup` / `su` | 7 | shell/job control overlap | Defer |

## Intake rule

New rows require: utility name, stage, stepper surface, blocked actions, tier
target, and next action. Do not start factory work without a row.
