use super::{exsequi, quaere, scalar};
use faber::Valor;
use std::time::{SystemTime, UNIX_EPOCH};

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
