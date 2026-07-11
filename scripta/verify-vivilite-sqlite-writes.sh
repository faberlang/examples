#!/usr/bin/env bash
set -euo pipefail

repo_root=$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)
fixture=$(mktemp -d "${TMPDIR:-/tmp}/vivilite-sqlite-writes.XXXXXX")
trap 'rm -rf "$fixture"' EXIT

faber=(cargo run --quiet --manifest-path "$repo_root/../faber/Cargo.toml" --)
vivilite="$repo_root/vivilite/target/debug/vivilite"

fail() {
    printf 'FAIL: %s\n' "$*" >&2
    exit 1
}

expect_one_item() {
    local kind=$1
    local subject=$2
    local listing

    listing=$(vivi "$kind" list --for hunter --project "$fixture" --json)
    jq -e --arg subject "$subject" \
        'length == 1 and .[0].subject == $subject and .[0].status == "open"' \
        <<<"$listing" >/dev/null || fail "regular Vivi could not list $kind send"

    local handle
    handle=$(jq -r '.[0].handle' <<<"$listing")
    vivi "$kind" show "$handle" --project "$fixture" | grep -Fq 'oracle body' ||
        fail "regular Vivi could not read $kind body"
}

send() {
    local kind=$1
    "$vivilite" "$kind" send \
        --from reviewer \
        --to hunter \
        --subject "oracle $kind" \
        --body 'oracle body' \
        --project "$fixture"
}

"${faber[@]}" build "$repo_root/vivilite"
vivi mailspace init --project "$fixture" >/dev/null
vivi mailspace identity add hunter --project "$fixture" >/dev/null
vivi mailspace identity add reviewer --project "$fixture" >/dev/null

send mail
mail_handle=$(vivi mail list --for hunter --project "$fixture" | awk 'NR == 1 { print $1 }')
[[ -n "$mail_handle" ]] || fail 'regular Vivi could not list mail send'
vivi mail show "$mail_handle" --project "$fixture" --json |
    jq -e '.[0].subject == "oracle mail" and .[0].body == "oracle body\r\n"' >/dev/null ||
    fail 'regular Vivi could not read mail body'

for kind in task need want; do
    send "$kind"
    expect_one_item "$kind" "oracle $kind"
done

sent_count=$(vivi mail list --for reviewer --folder sent --project "$fixture" | awk 'NF { count++ } END { print count + 0 }')
[[ "$sent_count" -eq 4 ]] || fail "expected four regular Vivi sent copies, found $sent_count"

status=$(vivi mailspace status --project "$fixture" --json)
jq -e '.totals.tasks_open == 1 and .totals.needs_open == 1 and .totals.wants_open == 1' \
    <<<"$status" >/dev/null || fail 'regular Vivi totals do not match the three work-item sends'

database="$fixture/.vivi/mail.sqlite"
sqlite3 "$database" <<'SQL'
CREATE TRIGGER reject_oracle_mail_event
BEFORE INSERT ON mailspace_events
WHEN NEW.command = 'mail send'
BEGIN
    SELECT RAISE(ABORT, 'forced oracle failure');
END;
SQL
before_database=$(sqlite3 "$database" .dump)
before_blobs=$(find "$fixture/.vivi/blobs" -type f | sort)

failure_output=$("$vivilite" mail send --from reviewer --to hunter --subject 'must roll back' \
    --body 'must not persist' --project "$fixture" 2>&1)
grep -Fq 'forced oracle failure' <<<"$failure_output" ||
    fail 'forced mid-write failure was not reported'

after_database=$(sqlite3 "$database" .dump)
after_blobs=$(find "$fixture/.vivi/blobs" -type f | sort)
[[ "$after_database" == "$before_database" ]] || fail 'forced failure changed SQLite state'
[[ "$after_blobs" == "$before_blobs" ]] || fail 'forced failure changed content-addressed blobs'

printf 'PASS: ViviLite SQLite sends match regular Vivi and roll back atomically\n'
