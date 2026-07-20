pub mod mathesis {
    #[must_use] 
    pub fn quadratum(x: i64) -> i64 {
        x * x
    }

    #[must_use] 
    pub fn cubum(x: i64) -> i64 {
        x * x * x
    }

    #[must_use] 
    pub fn duplicatum(x: f64) -> f64 {
        x * 2.0
    }

    #[must_use] 
    pub fn dimidium(x: f64) -> f64 {
        x / 2.0
    }

    #[must_use] 
    pub fn maximus(a: f64, b: f64) -> f64 {
        a.max(b)
    }

    #[must_use] 
    pub fn minimus(a: f64, b: f64) -> f64 {
        a.min(b)
    }
}
