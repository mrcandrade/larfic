//! Identidade visual da Suíte FisiLab (UFRGS).
//!
//! Um crate pequeno, só com `egui`, que cada aplicativo da suíte usa para:
//!
//! - [`palette`]: as cores da marca (vermelho da chama, marinho, creme, azul CTA e azul UFRGS) e os
//!   tons escuro e claro usados pela janela Sobre (os apps mantêm a paleta original deles);
//! - [`splash`]: a animação de abertura com a logo do CTA;
//! - [`about`]: a janela "Sobre", com créditos ao projeto de origem, o manifesto e as logos.
//!
//! Integração num app (três pontos):
//!
//! ```ignore
//! // main.rs, antes de eframe::run_native:
//! fisilab_brand::splash::enable();
//! // no fim do desenho de cada quadro (depois que as fontes do app estiverem prontas):
//! fisilab_brand::frame(ctx, &APP_INFO);
//! // no menu Ajuda:
//! if ui.button(fisilab_brand::ABOUT_MENU_LABEL).clicked() { fisilab_brand::about::open(ctx); }
//! ```

pub mod about;
pub mod palette;
pub mod splash;
mod textures;

/// Quem disponibiliza a suíte.
pub const LAB: &str = "FisiLab — LARFIC · UFRGS";
/// Nome completo do laboratório.
pub const LAB_FULL: &str = "Laboratório de Robótica, Inteligência Artificial e Física Computacional (LARFIC)";
/// Parceiro.
pub const PARTNER: &str = "CTA — Centro de Tecnologia Acadêmica";
/// Nome da suíte.
pub const SUITE: &str = "Suíte FisiLab";
/// Público.
pub const AUDIENCE: &str = "Para democratizar o acesso à tecnologia entre os alunos da UFRGS.";

/// Página da suíte (código-fonte, instaladores, créditos).
pub const SUITE_URL: &str = "https://github.com/mrcandrade/larfic/tree/main/suite-fisilab";
/// Manifesto completo.
pub const MANIFESTO_URL: &str = "https://github.com/mrcandrade/larfic/blob/main/suite-fisilab/MANIFESTO.md";
/// Centro de Tecnologia Acadêmica.
pub const CTA_URL: &str = "https://cta.if.ufrgs.br";

/// O rótulo do item de menu que abre a janela Sobre da suíte.
pub const ABOUT_MENU_LABEL: &str = "Sobre a Suíte FisiLab…";

/// O que cada aplicativo informa sobre si mesmo.
#[derive(Clone, Copy, Debug)]
pub struct AppInfo {
    /// Nome na suíte, por exemplo "Foto".
    pub name: &'static str,
    /// O que o programa faz, por exemplo "Editor de imagens".
    pub tagline: &'static str,
    /// Software proprietário equivalente, por exemplo "Adobe Photoshop".
    pub equivalent: &'static str,
    /// Versão exibida (normalmente `env!("CARGO_PKG_VERSION")`).
    pub version: &'static str,
    /// Projeto de origem, por exemplo "PhotoCraft".
    pub upstream_name: &'static str,
    /// Repositório do projeto de origem.
    pub upstream_url: &'static str,
    /// Linha de copyright do projeto de origem (do NOTICE dele).
    pub upstream_copyright: &'static str,
}

/// Desenha, por cima de tudo, o que a marca precisa neste quadro: a janela Sobre (quando aberta) e a
/// tela de abertura (enquanto dura). Chame no fim do desenho de cada quadro.
///
/// Devolve `true` enquanto a tela de abertura estiver visível.
pub fn frame(ctx: &egui::Context, app: &AppInfo) -> bool {
    about::show(ctx, app);
    splash::show(ctx, app)
}

/// Texto curto do manifesto, exibido na janela Sobre. O texto completo está em MANIFESTO.md.
pub const MANIFESTO_SHORT: &str = "\
Conhecimento produzido em uma universidade pública deve circular livremente. Por isso, as \
ferramentas que usamos para ensinar, pesquisar e criar também devem ser livres: qualquer pessoa \
pode usá-las, estudá-las, modificá-las e compartilhá-las.

Software livre dá autonomia à universidade: os arquivos continuam abertos daqui a vinte anos, \
ninguém perde o acesso quando uma licença vence, e estudantes não precisam pagar para aprender. \
Também é uma ferramenta de formação, porque o código pode ser lido e melhorado em sala de aula.

Esta suíte é um convite: use, aprenda, reporte problemas, contribua e dê crédito a quem construiu \
antes de nós.";
