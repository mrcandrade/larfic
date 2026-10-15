//! Cores da marca e os tons escuro ([`NOITE`]) e claro ([`DIA`]) da identidade da suíte.
//!
//! As cores de marca foram tiradas das logos: o vermelho e o marinho da chama do LARFIC, o creme do
//! fundo dela, o azul do CTA e o azul e o vermelho da UFRGS. Os apps mantêm a paleta original deles;
//! estes tons ficam para o que é da suíte (a janela Sobre e a tela de abertura).

use egui::Color32;

/// Vermelho da chama (logo do LARFIC).
pub const VERMELHO: Color32 = Color32::from_rgb(0xAD, 0x2C, 0x22);
/// Vermelho da chama, mais vivo, para destaque sobre fundo escuro.
pub const VERMELHO_VIVO: Color32 = Color32::from_rgb(0xC8, 0x40, 0x2F);
/// Vermelho claro, para hover sobre fundo escuro.
pub const VERMELHO_CLARO: Color32 = Color32::from_rgb(0xDE, 0x5A, 0x46);
/// Vermelho da UFRGS.
pub const VERMELHO_UFRGS: Color32 = Color32::from_rgb(0xDC, 0x2A, 0x1A);
/// Marinho das listras da logo do LARFIC.
pub const MARINHO: Color32 = Color32::from_rgb(0x1A, 0x25, 0x32);
/// Creme do fundo da logo do LARFIC.
pub const CREME: Color32 = Color32::from_rgb(0xF2, 0xEA, 0xDA);
/// Azul da logo do CTA.
pub const AZUL_CTA: Color32 = Color32::from_rgb(0x44, 0x80, 0xC4);
/// Azul do CTA, mais claro, para foco e links sobre fundo escuro.
pub const AZUL_CTA_CLARO: Color32 = Color32::from_rgb(0x6E, 0x9E, 0xD8);
/// Azul da UFRGS.
pub const AZUL_UFRGS: Color32 = Color32::from_rgb(0x00, 0x5A, 0x93);

/// Os papéis de cor da identidade da suíte, em versão escura ([`NOITE`]) e clara ([`DIA`]).
#[derive(Clone, Copy, Debug, PartialEq)]
pub struct Tons {
    /// Escuro (true) ou claro.
    pub escuro: bool,
    /// Fundo atrás dos documentos (área de trabalho, canvas vazio).
    pub fundo: Color32,
    /// Painéis, barras de ferramentas, menus.
    pub painel: Color32,
    /// Superfícies elevadas: cartões, campos, janelas flutuantes.
    pub elevado: Color32,
    /// Controles com o ponteiro em cima.
    pub hover: Color32,
    /// Controles pressionados / ativos sem seleção.
    pub ativo: Color32,
    /// Bordas e separadores.
    pub borda: Color32,
    /// Texto principal.
    pub texto: Color32,
    /// Texto secundário (rótulos, dicas, desabilitado).
    pub texto_fraco: Color32,
    /// Destaque principal: seleção, ferramenta ativa, botão primário.
    pub destaque: Color32,
    /// Destaque com o ponteiro em cima.
    pub destaque_hover: Color32,
    /// Texto sobre [`Tons::destaque`].
    pub texto_destaque: Color32,
    /// Destaque secundário: foco do teclado, links, informação.
    pub foco: Color32,
    /// Fundo de seleção de texto/itens (translúcido sobre o painel).
    pub selecao: Color32,
    /// Avisos.
    pub aviso: Color32,
    /// Erros.
    pub erro: Color32,
    /// Sucesso.
    pub sucesso: Color32,
}

/// Tons escuros da identidade da suíte.
pub const NOITE: Tons = Tons {
    escuro: true,
    fundo: Color32::from_rgb(0x0E, 0x14, 0x1C),
    painel: Color32::from_rgb(0x15, 0x1E, 0x2A),
    elevado: Color32::from_rgb(0x1C, 0x27, 0x35),
    hover: Color32::from_rgb(0x26, 0x33, 0x45),
    ativo: Color32::from_rgb(0x2F, 0x3E, 0x54),
    borda: Color32::from_rgb(0x2C, 0x3A, 0x4E),
    texto: Color32::from_rgb(0xEE, 0xE6, 0xD6),
    texto_fraco: Color32::from_rgb(0x9F, 0xA9, 0xB8),
    destaque: VERMELHO_VIVO,
    destaque_hover: VERMELHO_CLARO,
    texto_destaque: Color32::from_rgb(0xFF, 0xF8, 0xEE),
    foco: AZUL_CTA_CLARO,
    selecao: Color32::from_rgba_premultiplied(0x4E, 0x19, 0x12, 0x63),
    aviso: Color32::from_rgb(0xE8, 0xB0, 0x4A),
    erro: Color32::from_rgb(0xF0, 0x6A, 0x5A),
    sucesso: Color32::from_rgb(0x5F, 0xB8, 0x7E),
};

/// Tons claros da identidade da suíte, no creme do papel da logo.
pub const DIA: Tons = Tons {
    escuro: false,
    fundo: Color32::from_rgb(0xDD, 0xD3, 0xC1),
    painel: Color32::from_rgb(0xF2, 0xEA, 0xDA),
    elevado: Color32::from_rgb(0xFA, 0xF6, 0xEE),
    hover: Color32::from_rgb(0xE4, 0xDA, 0xC6),
    ativo: Color32::from_rgb(0xD6, 0xCA, 0xB2),
    borda: Color32::from_rgb(0xCB, 0xBD, 0xA3),
    texto: MARINHO,
    texto_fraco: Color32::from_rgb(0x58, 0x62, 0x74),
    destaque: VERMELHO,
    destaque_hover: Color32::from_rgb(0x96, 0x24, 0x1B),
    texto_destaque: Color32::from_rgb(0xFF, 0xF8, 0xEE),
    foco: AZUL_UFRGS,
    selecao: Color32::from_rgba_premultiplied(0x2B, 0x0B, 0x09, 0x40),
    aviso: Color32::from_rgb(0x9A, 0x62, 0x00),
    erro: Color32::from_rgb(0xB0, 0x22, 0x18),
    sucesso: Color32::from_rgb(0x2E, 0x7D, 0x4F),
};

/// Os tons do tema escuro ou claro.
pub const fn tons(escuro: bool) -> &'static Tons {
    if escuro { &NOITE } else { &DIA }
}

/// Aplica os tons a um `egui::Visuals`. Serve de base: o tema do app pode, depois, ajustar
/// espessuras, cantos e sombras do seu próprio jeito, desde que mantenha as cores.
pub fn apply_visuals(v: &mut egui::Visuals, t: &Tons) {
    use egui::Stroke;
    v.dark_mode = t.escuro;
    v.override_text_color = None;
    v.panel_fill = t.painel;
    v.window_fill = t.elevado;
    v.extreme_bg_color = t.fundo;
    v.faint_bg_color = t.elevado;
    v.code_bg_color = t.elevado;
    v.window_stroke = Stroke::new(1.0, t.borda);
    v.hyperlink_color = t.foco;
    v.warn_fg_color = t.aviso;
    v.error_fg_color = t.erro;
    v.selection.bg_fill = t.destaque;
    v.selection.stroke = Stroke::new(1.0, t.texto_destaque);
    let w = &mut v.widgets;
    w.noninteractive.bg_fill = t.painel;
    w.noninteractive.weak_bg_fill = t.painel;
    w.noninteractive.bg_stroke = Stroke::new(1.0, t.borda);
    w.noninteractive.fg_stroke = Stroke::new(1.0, t.texto);
    w.inactive.bg_fill = t.elevado;
    w.inactive.weak_bg_fill = t.elevado;
    w.inactive.bg_stroke = Stroke::NONE;
    w.inactive.fg_stroke = Stroke::new(1.0, t.texto);
    w.hovered.bg_fill = t.hover;
    w.hovered.weak_bg_fill = t.hover;
    w.hovered.bg_stroke = Stroke::new(1.0, t.borda);
    w.hovered.fg_stroke = Stroke::new(1.5, t.texto);
    w.active.bg_fill = t.ativo;
    w.active.weak_bg_fill = t.ativo;
    w.active.bg_stroke = Stroke::new(1.0, t.foco);
    w.active.fg_stroke = Stroke::new(2.0, t.texto);
    w.open.bg_fill = t.hover;
    w.open.weak_bg_fill = t.hover;
    w.open.bg_stroke = Stroke::new(1.0, t.borda);
    w.open.fg_stroke = Stroke::new(1.0, t.texto);
}

/// Um `egui::Visuals` completo com os tons do tema.
pub fn visuals(escuro: bool) -> egui::Visuals {
    let mut v = if escuro { egui::Visuals::dark() } else { egui::Visuals::light() };
    apply_visuals(&mut v, tons(escuro));
    v
}

#[cfg(test)]
mod tests {
    use super::*;

    fn lum(c: Color32) -> f32 {
        let f = |x: u8| {
            let s = x as f32 / 255.0;
            if s <= 0.03928 { s / 12.92 } else { ((s + 0.055) / 1.055).powf(2.4) }
        };
        0.2126 * f(c.r()) + 0.7152 * f(c.g()) + 0.0722 * f(c.b())
    }

    fn contrast(a: Color32, b: Color32) -> f32 {
        let (x, y) = (lum(a), lum(b));
        (x.max(y) + 0.05) / (x.min(y) + 0.05)
    }

    #[test]
    fn text_meets_wcag_aa_on_every_surface() {
        for t in [&NOITE, &DIA] {
            for bg in [t.fundo, t.painel, t.elevado, t.hover] {
                assert!(contrast(t.texto, bg) >= 7.0, "texto {:?} sobre {bg:?}", t.texto);
                assert!(contrast(t.texto_fraco, bg) >= 3.0, "texto_fraco {:?} sobre {bg:?}", t.texto_fraco);
            }
            assert!(contrast(t.texto_destaque, t.destaque) >= 4.5, "texto sobre destaque");
            assert!(contrast(t.foco, t.painel) >= 3.0, "foco sobre painel");
        }
    }
}
