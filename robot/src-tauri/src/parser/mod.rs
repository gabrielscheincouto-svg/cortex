//! Parsers de conteúdo dos arquivos fiscais.
//!
//! Cada `parser_tipo` (definido no catálogo da obrigação) implementa o trait `FileParser`.
//! O pipeline chama o parser correspondente DEPOIS do identifier, para confirmar/refinar
//! o CNPJ e a competência extraídos do nome do arquivo, ou para extraí-los quando o nome
//! não traz essas informações.
//!
//! Por enquanto temos:
//!   - `sped_efd_contrib` — SPED EFD Contribuições (PIS/COFINS). Primeira linha (registro 0000)
//!     tem CNPJ e período (DT_INI/DT_FIN).

use std::path::Path;

pub mod dctfweb;
pub mod dirbi;
pub mod esocial;
pub mod sped;

/// Resultado da parseada — tudo opcional (parser pode não conseguir extrair tudo).
#[derive(Debug, Clone, Default)]
pub struct ParseHint {
    pub cnpj: Option<String>,
    pub competencia: Option<String>, // "yyyy-MM"
    pub razao_social: Option<String>,
}

pub trait FileParser {
    fn parse(&self, path: &Path) -> ParseHint;
}

/// Seleciona o parser correto para um `parser_tipo`. Devolve `None` quando o tipo é desconhecido.
pub fn for_tipo(tipo: &str) -> Option<Box<dyn FileParser + Send + Sync>> {
    match tipo {
        "dctfweb" => Some(Box::new(dctfweb::DctfWebParser)),
        "dirbi" => Some(Box::new(dirbi::DirbiParser)),
        "esocial" | "esocial_xml" => Some(Box::new(esocial::EsocialParser)),
        "sped_efd_contrib" | "sped_efd" => Some(Box::new(sped::SpedParser)),
        _ => None,
    }
}
