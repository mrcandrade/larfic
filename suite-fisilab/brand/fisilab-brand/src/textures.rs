//! As logos, embutidas como RGBA cru (sem decodificador de imagem) e enviadas à GPU uma vez.

use egui::{ColorImage, Context, Id, TextureHandle, TextureOptions};

pub(crate) struct Logo {
    name: &'static str,
    size: [usize; 2],
    rgba: &'static [u8],
}

/// Centro de Tecnologia Acadêmica.
pub(crate) const CTA: Logo = Logo { name: "cta", size: [500, 174], rgba: include_bytes!("../assets/cta.rgba") };
/// LARFIC (a chama).
pub(crate) const LARFIC: Logo = Logo { name: "larfic", size: [256, 256], rgba: include_bytes!("../assets/larfic.rgba") };

impl Logo {
    /// Largura / altura.
    pub(crate) fn aspect(&self) -> f32 {
        self.size[0] as f32 / self.size[1] as f32
    }

    /// A textura, carregada na primeira chamada e guardada na memória do contexto.
    pub(crate) fn texture(&self, ctx: &Context) -> TextureHandle {
        let id = Id::new(("fisilab-brand-logo", self.name));
        if let Some(t) = ctx.data(|d| d.get_temp::<TextureHandle>(id)) {
            return t;
        }
        let image = ColorImage::from_rgba_unmultiplied(self.size, self.rgba);
        let t = ctx.load_texture(format!("fisilab-brand/{}", self.name), image, TextureOptions::LINEAR);
        ctx.data_mut(|d| d.insert_temp(id, t.clone()));
        t
    }
}
