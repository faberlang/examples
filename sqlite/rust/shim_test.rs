use super::{exsequi, exsequi_batch, quaere, scalar, sha256_hex, transactio};
use faber::Valor;
use std::collections::BTreeMap;
use std::time::{SystemTime, UNIX_EPOCH};

fn step(sql: &str, params: Vec<Valor>) -> Valor {
    Valor::Tabula(BTreeMap::from([
        ("sql".to_owned(), Valor::Textus(sql.to_owned())),
        ("params".to_owned(), Valor::Lista(params)),
    ]))
}

#[test]
fn parameterized_write_query_and_scalar_round_trip() {
    let stamp = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .expect("clock")
        .as_nanos();
    let path = std::env::temp_dir().join(format!("faber-sqlite-{stamp}.sqlite"));
    let via = path.display().to_string();

    exsequi(
        via.clone(),
        "CREATE TABLE message (id INTEGER PRIMARY KEY, subject TEXT NOT NULL)".to_owned(),
        Vec::new(),
    )
    .expect("create table");
    let effect = exsequi(
        via.clone(),
        "INSERT INTO message(subject) VALUES (?1)".to_owned(),
        vec![Valor::Textus("salve".to_owned())],
    )
    .expect("insert row");
    assert_eq!(
        effect,
        Valor::Tabula(std::collections::BTreeMap::from([
            ("last_insert_id".to_owned(), Valor::Numerus(1)),
            ("rows_changed".to_owned(), Valor::Numerus(1)),
        ]))
    );

    let rows = quaere(
        via.clone(),
        "SELECT id, subject FROM message WHERE subject = ?1".to_owned(),
        vec![Valor::Textus("salve".to_owned())],
    )
    .expect("query row");
    assert_eq!(rows.len(), 1);
    assert_eq!(
        scalar(
            via,
            "SELECT subject FROM message WHERE id = ?1".to_owned(),
            vec![Valor::Numerus(1)],
        )
        .expect("query scalar"),
        Some(Valor::Textus("salve".to_owned()))
    );

    std::fs::remove_file(path).expect("remove fixture database");
}

#[test]
fn aggregate_parameters_fail_before_sql_execution() {
    let error = scalar(
        ":memory:".to_owned(),
        "SELECT ?1".to_owned(),
        vec![Valor::Lista(Vec::new())],
    )
    .expect_err("aggregate parameter must fail");
    assert!(error.contains("scalar valor"));
}

#[test]
fn sha256_hex_matches_canonical_vectors() {
    assert_eq!(
        sha256_hex(Vec::new()),
        "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"
    );
    assert_eq!(
        sha256_hex(b"abc".to_vec()),
        "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad"
    );
}

#[test]
fn batch_commits_all_statements_on_success() {
    let path = fixture_path("batch-success");
    let via = path.display().to_string();
    exsequi(
        via.clone(),
        "CREATE TABLE item (id INTEGER PRIMARY KEY, name TEXT UNIQUE NOT NULL)".to_owned(),
        Vec::new(),
    )
    .expect("create table");

    let effects = exsequi_batch(
        via.clone(),
        vec![
            batch_statement("INSERT INTO item(name) VALUES (?1)", "prima"),
            batch_statement("INSERT INTO item(name) VALUES (?1)", "secunda"),
        ],
    )
    .expect("commit batch");

    assert_eq!(effects.len(), 2);
    assert_eq!(
        scalar(via, "SELECT COUNT(*) FROM item".to_owned(), Vec::new()).expect("count rows"),
        Some(Valor::Numerus(2))
    );
    std::fs::remove_file(path).expect("remove fixture database");
}

#[test]
fn batch_rolls_back_every_statement_on_failure() {
    let path = fixture_path("batch-rollback");
    let via = path.display().to_string();
    exsequi(
        via.clone(),
        "CREATE TABLE item (id INTEGER PRIMARY KEY, name TEXT UNIQUE NOT NULL)".to_owned(),
        Vec::new(),
    )
    .expect("create table");

    exsequi_batch(
        via.clone(),
        vec![
            batch_statement("INSERT INTO item(name) VALUES (?1)", "idem"),
            batch_statement("INSERT INTO item(name) VALUES (?1)", "idem"),
        ],
    )
    .expect_err("duplicate insert must fail the batch");

    assert_eq!(
        scalar(via, "SELECT COUNT(*) FROM item".to_owned(), Vec::new()).expect("count rows"),
        Some(Valor::Numerus(0))
    );
    std::fs::remove_file(path).expect("remove fixture database");
}

fn batch_statement(sql: &str, param: &str) -> Valor {
    Valor::Tabula(std::collections::BTreeMap::from([
        ("sql".to_owned(), Valor::Textus(sql.to_owned())),
        (
            "params".to_owned(),
            Valor::Lista(vec![Valor::Textus(param.to_owned())]),
        ),
    ]))
}

fn fixture_path(label: &str) -> std::path::PathBuf {
    let stamp = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .expect("clock")
        .as_nanos();
    std::env::temp_dir().join(format!("faber-sqlite-{label}-{stamp}.sqlite"))
}

#[test]
fn transaction_commits_all_steps() {
    let stamp = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .expect("clock")
        .as_nanos();
    let path = std::env::temp_dir().join(format!("faber-sqlite-tx-ok-{stamp}.sqlite"));
    let via = path.display().to_string();

    exsequi(
        via.clone(),
        "CREATE TABLE item (id INTEGER PRIMARY KEY, name TEXT NOT NULL)".to_owned(),
        Vec::new(),
    )
    .expect("create");

    let effect = transactio(
        via.clone(),
        vec![
            step(
                "INSERT INTO item(name) VALUES (?1)",
                vec![Valor::Textus("a".into())],
            ),
            step(
                "INSERT INTO item(name) VALUES (?1)",
                vec![Valor::Textus("b".into())],
            ),
        ],
    )
    .expect("commit");
    assert_eq!(
        effect,
        Valor::Tabula(BTreeMap::from([
            ("last_insert_id".to_owned(), Valor::Numerus(2)),
            ("rows_changed".to_owned(), Valor::Numerus(2)),
        ]))
    );
    let count = scalar(via, "SELECT COUNT(*) FROM item".to_owned(), Vec::new())
        .expect("count")
        .expect("row");
    assert_eq!(count, Valor::Numerus(2));
    std::fs::remove_file(path).expect("cleanup");
}

#[test]
fn transaction_rolls_back_on_step_error() {
    let stamp = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .expect("clock")
        .as_nanos();
    let path = std::env::temp_dir().join(format!("faber-sqlite-tx-rb-{stamp}.sqlite"));
    let via = path.display().to_string();

    exsequi(
        via.clone(),
        "CREATE TABLE item (id INTEGER PRIMARY KEY, name TEXT NOT NULL UNIQUE)".to_owned(),
        Vec::new(),
    )
    .expect("create");

    let err = transactio(
        via.clone(),
        vec![
            step(
                "INSERT INTO item(name) VALUES (?1)",
                vec![Valor::Textus("solo".into())],
            ),
            // UNIQUE violation after first insert — whole batch must roll back.
            step(
                "INSERT INTO item(name) VALUES (?1)",
                vec![Valor::Textus("solo".into())],
            ),
        ],
    )
    .expect_err("duplicate should fail");
    assert!(!err.is_empty());

    let count = scalar(via, "SELECT COUNT(*) FROM item".to_owned(), Vec::new())
        .expect("count")
        .expect("row");
    assert_eq!(
        count,
        Valor::Numerus(0),
        "failed transaction must not leave partial rows"
    );
    std::fs::remove_file(path).expect("cleanup");
}
