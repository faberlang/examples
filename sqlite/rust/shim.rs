use faber::Valor;
use rusqlite::types::{Value, ValueRef};
use rusqlite::{params_from_iter, Connection, Row};
use sha2::{Digest, Sha256};
use std::collections::BTreeMap;

/// Execute a single SQL statement with the given parameters.
///
/// # Errors
///
/// Returns `Err` if the database cannot be opened, if parameter binding
/// fails, or if SQL execution fails.
pub fn exsequi(via: String, sql: String, params: Vec<Valor>) -> Result<Valor, String> {
    let connection = Connection::open(via).map_err(|e| sqlite_error(&e))?;
    let params = bind_values(params)?;
    let rows_changed = connection
        .execute(&sql, params_from_iter(params))
        .map_err(|e| sqlite_error(&e))?;
    let rows_changed = i64::try_from(rows_changed).map_err(|error| error.to_string())?;
    Ok(execution_effect(
        rows_changed,
        connection.last_insert_rowid(),
    ))
}

/// Execute multiple SQL statements atomically within a single transaction.
///
/// # Errors
///
/// Returns `Err` if the database cannot be opened, if a statement is
/// malformed, if parameter binding fails, if any SQL execution fails,
/// or if the transaction cannot be committed.
pub fn exsequi_batch(via: String, statements: Vec<Valor>) -> Result<Vec<Valor>, String> {
    let statements = statements
        .into_iter()
        .map(read_batch_statement)
        .collect::<Result<Vec<_>, _>>()?;
    let mut connection = Connection::open(via).map_err(|e| sqlite_error(&e))?;
    let transaction = connection.transaction().map_err(|e| sqlite_error(&e))?;
    let mut effects = Vec::with_capacity(statements.len());

    for (sql, params) in statements {
        let rows_changed = transaction
            .execute(&sql, params_from_iter(params))
            .map_err(|e| sqlite_error(&e))?;
        let rows_changed = i64::try_from(rows_changed).map_err(|error| error.to_string())?;
        effects.push(execution_effect(
            rows_changed,
            transaction.last_insert_rowid(),
        ));
    }

    transaction.commit().map_err(|e| sqlite_error(&e))?;
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
    let Some(Valor::Textus(sql)) = fields.remove("sql") else {
        return Err("SQLite batch statement field 'sql' must be textus".to_owned());
    };
    let params = match fields.remove("params") {
        Some(Valor::Lista(params)) => bind_values(params)?,
        _ => return Err("SQLite batch statement field 'params' must be lista<valor>".to_owned()),
    };
    Ok((sql, params))
}

/// Query the database and return all matching rows as a vector of tabula values.
///
/// # Errors
///
/// Returns `Err` if the database cannot be opened, if SQL preparation
/// fails, if parameter binding fails, or if query execution or row
/// reading fails.
pub fn quaere(via: String, sql: String, params: Vec<Valor>) -> Result<Vec<Valor>, String> {
    let connection = Connection::open(via).map_err(|e| sqlite_error(&e))?;
    let params = bind_values(params)?;
    let mut statement = connection.prepare(&sql).map_err(|e| sqlite_error(&e))?;
    let column_names = statement
        .column_names()
        .into_iter()
        .map(str::to_owned)
        .collect::<Vec<_>>();
    let rows = statement
        .query_map(params_from_iter(params), |row| read_row(row, &column_names))
        .map_err(|e| sqlite_error(&e))?;
    rows.map(|row| row.map_err(|e| sqlite_error(&e))).collect()
}

/// Execute a query and return the first column of the first row, or `None`.
///
/// # Errors
///
/// Returns `Err` if the database cannot be opened, if SQL preparation
/// fails, if parameter binding fails, or if query execution or value
/// reading fails.
pub fn scalar(via: String, sql: String, params: Vec<Valor>) -> Result<Option<Valor>, String> {
    let connection = Connection::open(via).map_err(|e| sqlite_error(&e))?;
    let params = bind_values(params)?;
    let mut statement = connection.prepare(&sql).map_err(|e| sqlite_error(&e))?;
    let mut rows = statement
        .query(params_from_iter(params))
        .map_err(|e| sqlite_error(&e))?;
    rows.next()
        .map_err(|e| sqlite_error(&e))?
        .map(|row| row.get_ref(0).map(read_value).map_err(|e| sqlite_error(&e)))
        .transpose()
}

/// Run `steps` atomically. Each step is a `valor` tabula with keys:
/// - `sql` (`textus`)
/// - `params` (`lista<valor>` of scalars; empty/missing → no binds)
///
/// On any error the whole transaction rolls back. Success returns a tabula
/// `{ rows_changed, last_insert_id }` for the cumulative effect.
///
/// # Errors
///
/// Returns `Err` if the database cannot be opened, if a step is malformed,
/// if parameter binding fails, if any SQL execution fails, or if the
/// transaction cannot be committed.
pub fn transactio(via: String, steps: Vec<Valor>) -> Result<Valor, String> {
    let mut connection = Connection::open(via).map_err(|e| sqlite_error(&e))?;
    let tx = connection.transaction().map_err(|e| sqlite_error(&e))?;
    let mut rows_changed_total: i64 = 0;
    for (index, step) in steps.into_iter().enumerate() {
        let (sql, params) = parse_transaction_step(step, index)?;
        let params = bind_values(params)?;
        let changed = tx
            .execute(&sql, params_from_iter(params))
            .map_err(|e| sqlite_error(&e))?;
        let changed = i64::try_from(changed).map_err(|error| error.to_string())?;
        rows_changed_total = rows_changed_total.saturating_add(changed);
    }
    let last_insert_id = tx.last_insert_rowid();
    tx.commit().map_err(|e| sqlite_error(&e))?;
    Ok(Valor::Tabula(BTreeMap::from([
        (
            "rows_changed".to_owned(),
            Valor::Numerus(rows_changed_total),
        ),
        ("last_insert_id".to_owned(), Valor::Numerus(last_insert_id)),
    ])))
}

fn parse_transaction_step(step: Valor, index: usize) -> Result<(String, Vec<Valor>), String> {
    let Valor::Tabula(fields) = step else {
        return Err(format!(
            "transaction step {index} must be a tabula with sql and params"
        ));
    };
    let sql = match fields.get("sql") {
        Some(Valor::Textus(sql)) => sql.clone(),
        Some(_) => {
            return Err(format!("transaction step {index} field sql must be textus"));
        }
        None => {
            return Err(format!("transaction step {index} missing sql field"));
        }
    };
    let params = match fields.get("params") {
        Some(Valor::Lista(params)) => params.clone(),
        Some(Valor::Nihil) | None => Vec::new(),
        Some(_) => {
            return Err(format!(
                "transaction step {index} field params must be lista<valor>"
            ));
        }
    };
    Ok((sql, params))
}

#[must_use] 
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

fn sqlite_error(error: &rusqlite::Error) -> String {
    error.to_string()
}

#[cfg(test)]
#[path = "shim_test.rs"]
mod tests;
