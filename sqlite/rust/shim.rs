use faber::Valor;
use rusqlite::types::{Value, ValueRef};
use rusqlite::{params_from_iter, Connection, Row};
use std::collections::BTreeMap;

pub fn exsequi(via: String, sql: String, params: Vec<Valor>) -> Result<Valor, String> {
    let connection = Connection::open(via).map_err(sqlite_error)?;
    let params = bind_values(params)?;
    let rows_changed = connection
        .execute(&sql, params_from_iter(params))
        .map_err(sqlite_error)?;
    let rows_changed = i64::try_from(rows_changed).map_err(|error| error.to_string())?;
    Ok(Valor::Tabula(BTreeMap::from([
        ("rows_changed".to_owned(), Valor::Numerus(rows_changed)),
        (
            "last_insert_id".to_owned(),
            Valor::Numerus(connection.last_insert_rowid()),
        ),
    ])))
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
