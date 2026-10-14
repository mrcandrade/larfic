//! A tela de abertura: a logo do CTA se revela da esquerda para a direita sobre o creme, uma linha
//! vermelha (a chama) cresce embaixo dela, o nome do app aparece, e tudo some em fade.
//!
//! Dura cerca de 3 s. Um clique ou uma tecla pula para o fade. Fica desligada até o binário chamar
//! [`enable`], para que testes que montam a interface direto não a vejam; a variável de ambiente
//! `FISILAB_NO_SPLASH=1` também a desliga.

use crate::palette::{AZUL_UFRGS, CREME, MARINHO, VERMELHO};
use crate::textures::CTA;
use crate::AppInfo;
use egui::{Align2, Color32, Context, FontId, Id, Order, Pos2, Rect, Sense, Stroke, pos2, vec2};
use std::sync::atomic::{AtomicBool, Ordering};

static ENABLED: AtomicBool = AtomicBool::new(false);

/// Liga a tela de abertura (uma vez, em `main`, antes de abrir a janela).
pub fn enable() {
    let off = std::env::var_os("FISILAB_NO_SPLASH").is_some_and(|v| !v.is_empty() && v != "0");
    ENABLED.store(!off, Ordering::Relaxed);
}

/// Revelação da logo.
const LOGO_START: f32 = 0.15;
const LOGO_DUR: f32 = 0.95;
/// Linha vermelha.
const LINE_START: f32 = 0.85;
const LINE_DUR: f32 = 0.55;
/// Nome do app.
const NAME_START: f32 = 1.15;
const NAME_DUR: f32 = 0.55;
/// Fade final.
const FADE: f32 = 0.45;
const TOTAL: f32 = 3.0;

#[derive(Clone, Copy, Default)]
struct State {
    elapsed: f32,
    last: Option<f64>,
    skip_at: Option<f32>,
    done: bool,
}

fn ease_out(x: f32) -> f32 {
    let x = x.clamp(0.0, 1.0);
    1.0 - (1.0 - x).powi(3)
}

fn phase(t: f32, start: f32, dur: f32) -> f32 {
    ease_out((t - start) / dur)
}

/// Desenha a tela de abertura neste quadro, por cima de tudo. Devolve `true` enquanto ela estiver
/// visível (o app pode, se quiser, adiar trabalho pesado até lá).
pub fn show(ctx: &Context, app: &AppInfo) -> bool {
    if !ENABLED.load(Ordering::Relaxed) {
        return false;
    }
    let id = Id::new("fisilab-brand-splash");
    let mut st: State = ctx.data(|d| d.get_temp(id)).unwrap_or_default();
    if st.done {
        return false;
    }
    // O tempo avança no máximo 1/30 s por quadro: os primeiros quadros de um app (fontes, GPU)
    // podem demorar, e a animação não deve pular etapas por isso.
    let now = ctx.input(|i| i.time);
    if let Some(last) = st.last {
        st.elapsed += ((now - last) as f32).clamp(0.0, 1.0 / 30.0);
    }
    st.last = Some(now);
    let t = st.elapsed;

    let skip = ctx.input(|i| {
        i.pointer.any_click() || i.events.iter().any(|e| matches!(e, egui::Event::Key { pressed: true, .. }))
    });
    if skip && st.skip_at.is_none() && t < TOTAL - FADE {
        st.skip_at = Some(t);
    }
    let fade_start = st.skip_at.unwrap_or(TOTAL - FADE);
    if t >= fade_start + FADE {
        st.done = true;
        ctx.data_mut(|d| d.insert_temp(id, st));
        ctx.request_repaint();
        return false;
    }
    let alpha = if t > fade_start { 1.0 - (t - fade_start) / FADE } else { 1.0 };
    ctx.data_mut(|d| d.insert_temp(id, st));

    let screen = ctx.content_rect();
    egui::Area::new(id.with("area"))
        .order(Order::Debug)
        .fixed_pos(screen.min)
        .interactable(true)
        .show(ctx, |ui| {
            // Cobre a janela inteira e engole os cliques enquanto a abertura estiver na tela.
            let _ = ui.allocate_rect(screen, Sense::click_and_drag());
            paint(ui.painter(), screen, t, alpha, app, ctx);
        });
    ctx.request_repaint();
    true
}

fn fade(c: Color32, a: f32) -> Color32 {
    c.gamma_multiply(a.clamp(0.0, 1.0))
}

fn paint(p: &egui::Painter, screen: Rect, t: f32, alpha: f32, app: &AppInfo, ctx: &Context) {
    p.rect_filled(screen, 0.0, fade(CREME, alpha));

    let c = screen.center();
    let logo_w = (screen.width() * 0.42).clamp(180.0, 440.0);
    let logo_h = logo_w / CTA.aspect();

    // As listras horizontais da logo do LARFIC, abrindo do centro, bem discretas.
    let stripes = 9;
    let stripe_top = c.y + logo_h * 0.55 + 70.0;
    for i in 0..stripes {
        let k = phase(t, 0.05 + i as f32 * 0.05, 0.8);
        let y = stripe_top + i as f32 * 7.0;
        if y > screen.bottom() - 40.0 {
            break;
        }
        // Mais largas no meio, como a elipse da logo.
        let f = 1.0 - ((i as f32 - (stripes - 1) as f32 / 2.0) / stripes as f32).abs() * 1.4;
        let half = logo_w * 0.75 * f * k;
        p.line_segment(
            [pos2(c.x - half, y), pos2(c.x + half, y)],
            Stroke::new(1.5 + i as f32 * 0.15, fade(MARINHO, alpha * 0.10)),
        );
    }

    // A logo do CTA se revela da esquerda para a direita e sobe alguns pontos.
    let r = phase(t, LOGO_START, LOGO_DUR);
    if r > 0.0 {
        let tex = CTA.texture(ctx);
        let top = c.y - logo_h * 0.5 - 40.0 + (1.0 - r) * 14.0;
        let full = Rect::from_min_size(pos2(c.x - logo_w * 0.5, top), vec2(logo_w, logo_h));
        let shown = Rect::from_min_max(full.min, pos2(full.min.x + full.width() * r, full.max.y));
        let uv = Rect::from_min_max(Pos2::ZERO, pos2(r, 1.0));
        p.image(tex.id(), shown, uv, fade(Color32::WHITE, alpha * r.sqrt()));

        // A linha vermelha (a chama) cresce do centro para fora.
        let l = phase(t, LINE_START, LINE_DUR);
        let line_y = full.max.y + 22.0;
        if l > 0.0 {
            let half = logo_w * 0.32 * l;
            p.line_segment([pos2(c.x - half, line_y), pos2(c.x + half, line_y)], Stroke::new(3.0, fade(VERMELHO, alpha)));
        }

        // O nome do app e o que ele é.
        let n = phase(t, NAME_START, NAME_DUR);
        if n > 0.0 {
            let rise = (1.0 - n) * 8.0;
            p.text(
                pos2(c.x, line_y + 20.0 + rise),
                Align2::CENTER_TOP,
                app.name,
                FontId::proportional(32.0),
                fade(MARINHO, alpha * n),
            );
            p.text(
                pos2(c.x, line_y + 62.0 + rise),
                Align2::CENTER_TOP,
                app.tagline,
                FontId::proportional(15.0),
                fade(AZUL_UFRGS, alpha * n),
            );
        }
    }

    // Rodapé: quem disponibiliza e em parceria com quem.
    let f = phase(t, NAME_START + 0.2, NAME_DUR);
    if f > 0.0 {
        let y = screen.bottom() - 28.0;
        p.text(
            pos2(c.x, y - 18.0),
            Align2::CENTER_BOTTOM,
            format!("{} · Disponibilizado pelo {} em parceria com o {}", crate::SUITE, crate::LAB, crate::PARTNER),
            FontId::proportional(12.5),
            fade(MARINHO, alpha * f * 0.85),
        );
        p.text(
            pos2(c.x, y),
            Align2::CENTER_BOTTOM,
            format!("Software livre baseado no {} · {}", app.upstream_name, crate::AUDIENCE),
            FontId::proportional(11.5),
            fade(MARINHO, alpha * f * 0.6),
        );
    }
}
