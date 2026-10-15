//! A janela "Sobre a Suíte FisiLab": o app, quem o disponibiliza, para quem, o crédito ao projeto
//! de origem, o manifesto e a logo do CTA.

use crate::palette::tons;
use crate::textures::{CTA, LARFIC};
use crate::AppInfo;
use egui::load::SizedTexture;
use egui::{Context, Id, RichText, vec2};

fn open_id() -> Id {
    Id::new("fisilab-brand-about-open")
}

/// Abre a janela (por exemplo, de um item do menu Ajuda).
pub fn open(ctx: &Context) {
    ctx.data_mut(|d| d.insert_temp(open_id(), true));
}

/// Se a janela está aberta.
pub fn is_open(ctx: &Context) -> bool {
    ctx.data(|d| d.get_temp::<bool>(open_id())).unwrap_or(false)
}

/// Desenha a janela, se estiver aberta. Chamada por [`crate::frame`].
pub fn show(ctx: &Context, app: &AppInfo) {
    let mut open = is_open(ctx);
    if !open {
        return;
    }
    let t = tons(ctx.global_style().visuals.dark_mode);
    egui::Window::new(format!("{} — Suíte FisiLab", app.name))
        .id(Id::new("fisilab-brand-about"))
        .open(&mut open)
        .collapsible(false)
        .resizable(true)
        .default_width(580.0)
        .default_height(560.0)
        .pivot(egui::Align2::CENTER_CENTER)
        .default_pos(ctx.content_rect().center())
        .show(ctx, |ui| {
            egui::ScrollArea::vertical().auto_shrink([false, true]).show(ui, |ui| {
                ui.horizontal(|ui| {
                    let tex = LARFIC.texture(ctx);
                    ui.add(egui::Image::new(SizedTexture::new(tex.id(), vec2(72.0, 72.0))).corner_radius(10.0));
                    ui.add_space(8.0);
                    ui.vertical(|ui| {
                        ui.label(RichText::new(app.name).size(26.0).strong().color(t.texto));
                        ui.label(RichText::new(format!("{} · versão {}", app.tagline, app.version)).color(t.texto_fraco));
                        ui.label(
                            RichText::new(format!("Alternativa livre ao {}", app.equivalent)).color(t.destaque).strong(),
                        );
                    });
                });
                ui.add_space(10.0);
                ui.separator();

                ui.add_space(6.0);
                ui.label(RichText::new(format!(
                    "Parte da {}, disponibilizada pelo {} ({}) em parceria com o {}.",
                    crate::SUITE,
                    crate::LAB,
                    crate::LAB_FULL,
                    crate::PARTNER
                )));
                ui.add_space(4.0);
                ui.label(RichText::new(crate::AUDIENCE).strong());

                ui.add_space(12.0);
                ui.label(RichText::new("Créditos").size(17.0).strong());
                ui.add_space(2.0);
                ui.label(format!(
                    "{} é uma versão modificada do {} ({}), distribuída sob a licença MIT ou Apache 2.0, \
                     à escolha de quem o usa. Agradecemos aos autores e contribuidores do projeto original: \
                     todo o trabalho de edição, formatos de arquivo e ferramentas é deles.",
                    app.name, app.upstream_name, app.upstream_copyright
                ));
                ui.add_space(2.0);
                ui.label(
                    "O FisiLab alterou o nome, a identidade visual, o tema de cores, a tela de abertura e o \
                     instalador. Os nomes e marcas do projeto original pertencem aos seus titulares; esta \
                     versão não é afiliada nem endossada por eles.",
                );
                ui.horizontal_wrapped(|ui| {
                    ui.hyperlink_to(format!("Projeto original: {}", app.upstream_name), app.upstream_url);
                    ui.label("·");
                    ui.hyperlink_to("Código-fonte da Suíte FisiLab", crate::SUITE_URL);
                });

                ui.add_space(12.0);
                ui.label(RichText::new("Manifesto pelas tecnologias livres").size(17.0).strong());
                ui.add_space(2.0);
                ui.label(crate::MANIFESTO_SHORT);
                ui.hyperlink_to("Ler o manifesto completo", crate::MANIFESTO_URL);

                ui.add_space(16.0);
                ui.separator();
                ui.add_space(8.0);
                ui.horizontal(|ui| {
                    // A logo do CTA sobre um cartão claro (ela foi desenhada para fundo branco).
                    let h = 44.0;
                    egui::Frame::new()
                        .fill(egui::Color32::WHITE)
                        .corner_radius(8.0)
                        .inner_margin(egui::Margin::symmetric(14, 10))
                        .show(ui, |ui| {
                            ui.horizontal(|ui| {
                                let c = CTA.texture(ctx);
                                let r = ui.add(
                                    egui::Image::new(SizedTexture::new(c.id(), vec2(h * CTA.aspect(), h)))
                                        .sense(egui::Sense::click()),
                                );
                                if r.on_hover_text(crate::CTA_URL).clicked() {
                                    ctx.open_url(egui::OpenUrl::new_tab(crate::CTA_URL));
                                }
                            });
                        });
                });
                ui.add_space(4.0);
            });
        });
    if !open {
        ctx.data_mut(|d| d.insert_temp(open_id(), false));
    }
}
