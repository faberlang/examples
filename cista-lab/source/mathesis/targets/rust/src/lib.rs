pub mod mathesis {
    pub fn quadratum(x: i64) -> i64 {
        x * x
    }

    pub fn cubum(x: i64) -> i64 {
        x * x * x
    }

    pub fn duplicatum(x: f64) -> f64 {
        x * 2.0
    }

    pub fn dimidium(x: f64) -> f64 {
        x / 2.0
    }

    pub fn maximus(a: f64, b: f64) -> f64 {
        a.max(b)
    }

    pub fn minimus(a: f64, b: f64) -> f64 {
        a.min(b)
    }
}
