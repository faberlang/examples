use faber::Valor;
use rusqlite::types::{Value, ValueRef};
use rusqlite::{params_from_iter, Connection, Row};
use sha2::{Digest, Sha256};
use std::collections::BTreeMap;

pub fn exsequi(via: String, sql: String, params: Vec<Valor>) -> Result<Valor, String> {
    let connection = Connection::open(via).map_err(sqlite_error)?;
    let params = bind_values(params)?;
    let rows_changed = connection
        .execute(&sql, params_from_iter(params))
        .map_err(sqlite_error)?;
    let rows_changed = i64::try_from(rows_changed).map_err(|error| error.to_string())?;
    Ok(execution_effect(
        rows_changed,
        connection.last_insert_rowid(),
    ))
}

pub fn exsequi_batch(via: String, statements: Vec<Valor>) -> Result<Vec<Valor>, String> {
    let statements = statements
        .into_iter()
        .map(read_batch_statement)
        .collect::<Result<Vec<_>, _>>()?;
    let mut connection = Connection::open(via).map_err(sqlite_error)?;
    let transaction = connection.transaction().map_err(sqlite_error)?;
    let mut effects = Vec::with_capacity(statements.len());

    for (sql, params) in statements {
        let rows_changed = transaction
            .execute(&sql, params_from_iter(params))
            .map_err(sqlite_error)?;
        let rows_changed = i64::try_from(rows_changed).map_err(|error| error.to_string())?;
        effects.push(execution_effect(
            rows_changed,
            transaction.last_insert_rowid(),
        ));
    }

    transaction.commit().map_err(sqlite_error)?;
    Ok(effects)
}

fn execution_effect(rows_changed: i64, last_insert_id: i64) -> Valor {
    Valor::Tabula(BTreeMap::from([
        ("rows_changed".to_owned(), Valor::Numerus(rows_changed)),
        ("last_insert_id".to_owned(), Valor::Numerus(last_insert_id)),
    ]))
}

fn read_batch_statement(statement: Valor) -> Result<(String, Vec<Value>), String> {
    let Valor::Tabula(mut fields) = statement else {
        return Err("SQLite batch statements must be valor tables".to_owned());
    };
    let sql = match fields.remove("sql") {
        Some(Valor::Textus(sql)) => sql,
        _ => return Err("SQLite batch statement field 'sql' must be textus".to_owned()),
    };
    let params = match fields.remove("params") {
        Some(Valor::Lista(params)) => bind_values(params)?,
        _ => return Err("SQLite batch statement field 'params' must be lista<valor>".to_owned()),
    };
    Ok((sql, params))
}

pub fn quaere(via: String, sql: String, params: Vec<Valor>) -> Result<Vec<Valor>, String> {
    let connection = Connection::open(via).map_err(sqlite_error)?;
    let params = bind_values(params)?;
    let mut statement = connection.prepare(&sql).map_err(sqlite_error)?;
    let column_names = statement
        .column_names()
        .into_iter()
        .map(str::to_owned)
        .collect::<Vec<_>>();
    let rows = statement
        .query_map(params_from_iter(params), |row| read_row(row, &column_names))
        .map_err(sqlite_error)?;
    rows.map(|row| row.map_err(sqlite_error)).collect()
}

pub fn scalar(via: String, sql: String, params: Vec<Valor>) -> Result<Option<Valor>, String> {
    let connection = Connection::open(via).map_err(sqlite_error)?;
    let params = bind_values(params)?;
    let mut statement = connection.prepare(&sql).map_err(sqlite_error)?;
    let mut rows = statement
        .query(params_from_iter(params))
        .map_err(sqlite_error)?;
    rows.next()
        .map_err(sqlite_error)?
        .map(|row| row.get_ref(0).map(read_value).map_err(sqlite_error))
        .transpose()
}

pub fn sha256_hex(bytes: Vec<u8>) -> String {
    format!("{:x}", Sha256::digest(bytes))
}

fn bind_values(params: Vec<Valor>) -> Result<Vec<Value>, String> {
    params.into_iter().map(bind_value).collect()
}

fn bind_value(value: Valor) -> Result<Value, String> {
    match value {
        Valor::Nihil => Ok(Value::Null),
        Valor::Bivalens(value) => Ok(Value::Integer(i64::from(value))),
        Valor::Numerus(value) => Ok(Value::Integer(value)),
        Valor::Fractus(value) => Ok(Value::Real(value)),
        Valor::Textus(value) | Valor::Instans(value) => Ok(Value::Text(value)),
        Valor::Octeti(value) => Ok(Value::Blob(value)),
        Valor::Lista(_) | Valor::Tabula(_) => {
            Err("SQLite parameters must be scalar valor values".to_owned())
        }
    }
}

fn read_row(row: &Row<'_>, column_names: &[String]) -> rusqlite::Result<Valor> {
    let fields = column_names
        .iter()
        .enumerate()
        .map(|(index, name)| Ok((name.clone(), read_value(row.get_ref(index)?))))
        .collect::<rusqlite::Result<BTreeMap<_, _>>>()?;
    Ok(Valor::Tabula(fields))
}

fn read_value(value: ValueRef<'_>) -> Valor {
    match value {
        ValueRef::Null => Valor::Nihil,
        ValueRef::Integer(value) => Valor::Numerus(value),
        ValueRef::Real(value) => Valor::Fractus(value),
        ValueRef::Text(value) => Valor::Textus(String::from_utf8_lossy(value).into_owned()),
        ValueRef::Blob(value) => Valor::Octeti(value.to_vec()),
    }
}

fn sqlite_error(error: rusqlite::Error) -> String {
    error.to_string()
}

#[cfg(test)]
#[path = "shim_test.rs"]
mod tests;
