//! Parser do registro 0000 da DCTFWeb.
//!
//! Layout compatível com SPED: |0000|DT_INI|DT_FIN|RAZAO|CNPJ|...

use super::{FileParser, ParseHint};
use std::{fs::File, io::{BufRead, BufReader}, path::Path};

pub struct DctfWebParser;

impl FileParser for DctfWebParser {
    fn parse(&self, path: &Path) -> ParseHint {
        let Ok(file) = File::open(path) else { return ParseHint::default() };
        let mut reader = BufReader::new(file);
        let mut line = String::new();
        if reader.read_line(&mut line).is_err() || line.is_empty() {
            return ParseHint::default();
        }

        let parts: Vec<&str> = line.trim_end_matches('\n').split('|').collect();
        if parts.len() < 6 || parts.get(1).copied() != Some("0000") {
            return ParseHint::default();
        }

        let dt_ini = parts.get(2).map(|s| s.trim()).unwrap_or("");
        let razao_social = parts.get(4).map(|s| s.trim().to_string()).filter(|s| !s.is_empty());
        let cnpj_raw = parts.get(5).map(|s| s.trim()).unwrap_or("");

        ParseHint {
            cnpj: digits_only(cnpj_raw).filter(|s| s.len() == 14),
            competencia: dt_ini_to_competencia(dt_ini),
            razao_social,
        }
    }
}

fn digits_only(s: &str) -> Option<String> {
    let out: String = s.chars().filter(|c| c.is_ascii_digit()).collect();
    if out.is_empty() { None } else { Some(out) }
}

fn dt_ini_to_competencia(s: &str) -> Option<String> {
    let digits = digits_only(s)?;
    if digits.len() != 8 { return None; }
    Some(format!("{}-{}", &digits[4..8], &digits[2..4]))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn competencia_ddmmyyyy() {
        assert_eq!(dt_ini_to_competencia("01052026").as_deref(), Some("2026-05"));
    }
}
