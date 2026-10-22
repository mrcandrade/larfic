/**
 * Apêndice E: fórmulas matemáticas, em Markdown com LaTeX (mesma sintaxe dos roteiros:
 * $…$ no meio do texto e $$…$$ numa linha própria).
 */
export interface BlocoFormulas {
  id: string;
  titulo: string;
  texto: string;
}

export const formulas: BlocoFormulas[] = [
  {
    id: "geometria",
    titulo: "Geometria",
    texto: String.raw`### Círculo de raio $r$
Circunferência $C = 2\pi r$; área $A = \pi r^2$. Um arco de ângulo $\theta$ (em radianos) tem comprimento $s = r\theta$.
### Esfera de raio $r$
Área da superfície $A = 4\pi r^2$; volume $V = \tfrac{4}{3}\pi r^3$.
### Cilindro circular reto de raio $r$ e altura $h$
Área lateral $2\pi r h$; área total $2\pi r(r + h)$; volume $V = \pi r^2 h$.
### Cone circular reto de raio $r$ e altura $h$
Geratriz $g = \sqrt{r^2 + h^2}$; área lateral $\pi r g$; volume $V = \tfrac{1}{3}\pi r^2 h$.
### Triângulo de base $b$ e altura $h$
Área $A = \tfrac{1}{2} b h$. Os ângulos internos somam $180^\circ$.`,
  },
  {
    id: "algebra",
    titulo: "Álgebra",
    texto: String.raw`### Equação do segundo grau
As raízes de $a x^2 + b x + c = 0$ (com $a \neq 0$) são
$$x = \frac{-b \pm \sqrt{b^2 - 4ac}}{2a}$$
### Potências e logaritmos
$a^m a^n = a^{m+n}$, $(a^m)^n = a^{mn}$, $a^{-n} = 1/a^n$.
$\ln(ab) = \ln a + \ln b$, $\ln(a/b) = \ln a - \ln b$, $\ln a^n = n \ln a$, $\log_{10} x = \ln x / \ln 10$.
### Sistema linear 2 × 2 (regra de Cramer)
Para $a_1 x + b_1 y = c_1$ e $a_2 x + b_2 y = c_2$:
$$x = \frac{c_1 b_2 - c_2 b_1}{a_1 b_2 - a_2 b_1}, \qquad y = \frac{a_1 c_2 - a_2 c_1}{a_1 b_2 - a_2 b_1}$$`,
  },
  {
    id: "trigonometria",
    titulo: "Trigonometria",
    texto: String.raw`### Triângulo retângulo
Com hipotenusa $c$, cateto oposto $a$ e cateto adjacente $b$ ao ângulo $\theta$: $\sin\theta = a/c$, $\cos\theta = b/c$, $\tan\theta = a/b$, e $a^2 + b^2 = c^2$ (teorema de Pitágoras).
### Triângulo qualquer
Com lados $a$, $b$, $c$ opostos aos ângulos $A$, $B$, $C$:
$$\frac{a}{\sin A} = \frac{b}{\sin B} = \frac{c}{\sin C} \qquad \text{(lei dos senos)}$$
$$c^2 = a^2 + b^2 - 2ab\cos C \qquad \text{(lei dos cossenos)}$$
### Identidades
$\sin^2\theta + \cos^2\theta = 1$; $\sec^2\theta = 1 + \tan^2\theta$.
$\sin(-\theta) = -\sin\theta$; $\cos(-\theta) = \cos\theta$; $\sin(\theta \pm 90^\circ) = \pm\cos\theta$.
$\sin 2\theta = 2\sin\theta\cos\theta$; $\cos 2\theta = \cos^2\theta - \sin^2\theta = 1 - 2\sin^2\theta$.
$$\sin(\alpha \pm \beta) = \sin\alpha\cos\beta \pm \cos\alpha\sin\beta$$
$$\cos(\alpha \pm \beta) = \cos\alpha\cos\beta \mp \sin\alpha\sin\beta$$
$$\sin\alpha + \sin\beta = 2\sin\frac{\alpha + \beta}{2}\cos\frac{\alpha - \beta}{2}$$
$$\cos\alpha + \cos\beta = 2\cos\frac{\alpha + \beta}{2}\cos\frac{\alpha - \beta}{2}$$`,
  },
  {
    id: "vetores",
    titulo: "Vetores",
    texto: String.raw`Com $\hat{i}$, $\hat{j}$, $\hat{k}$ os vetores unitários dos eixos $x$, $y$, $z$, $\vec{a} = a_x\hat{i} + a_y\hat{j} + a_z\hat{k}$, de módulo $a = \sqrt{a_x^2 + a_y^2 + a_z^2}$.
### Produto escalar
$$\vec{a}\cdot\vec{b} = a_x b_x + a_y b_y + a_z b_z = a b \cos\phi$$
em que $\phi$ é o menor ângulo entre os vetores. $\hat{i}\cdot\hat{i} = \hat{j}\cdot\hat{j} = \hat{k}\cdot\hat{k} = 1$ e $\hat{i}\cdot\hat{j} = \hat{j}\cdot\hat{k} = \hat{k}\cdot\hat{i} = 0$.
### Produto vetorial
$$\vec{a}\times\vec{b} = (a_y b_z - a_z b_y)\,\hat{i} + (a_z b_x - a_x b_z)\,\hat{j} + (a_x b_y - a_y b_x)\,\hat{k}$$
Módulo $|\vec{a}\times\vec{b}| = a b \sin\phi$, direção dada pela regra da mão direita. $\hat{i}\times\hat{j} = \hat{k}$, $\hat{j}\times\hat{k} = \hat{i}$, $\hat{k}\times\hat{i} = \hat{j}$, e $\vec{b}\times\vec{a} = -\,\vec{a}\times\vec{b}$.
### Identidades úteis
$\vec{a}\cdot(\vec{b}\times\vec{c}) = \vec{b}\cdot(\vec{c}\times\vec{a}) = \vec{c}\cdot(\vec{a}\times\vec{b})$
$\vec{a}\times(\vec{b}\times\vec{c}) = (\vec{a}\cdot\vec{c})\,\vec{b} - (\vec{a}\cdot\vec{b})\,\vec{c}$`,
  },
  {
    id: "derivadas",
    titulo: "Derivadas",
    texto: String.raw`Nas fórmulas, $u$ e $v$ são funções de $x$, e $a$, $m$ são constantes.
- $\dfrac{d}{dx}(a u) = a\,\dfrac{du}{dx}$ e $\dfrac{d}{dx}(u + v) = \dfrac{du}{dx} + \dfrac{dv}{dx}$
- $\dfrac{d}{dx}(u v) = u\,\dfrac{dv}{dx} + v\,\dfrac{du}{dx}$ (regra do produto)
- $\dfrac{d}{dx}\left(\dfrac{u}{v}\right) = \dfrac{v\,du/dx - u\,dv/dx}{v^2}$ (regra do quociente)
- $\dfrac{d}{dx} f(u) = \dfrac{df}{du}\,\dfrac{du}{dx}$ (regra da cadeia)
- $\dfrac{d}{dx} x^m = m x^{m-1}$
- $\dfrac{d}{dx} \ln x = \dfrac{1}{x}$ e $\dfrac{d}{dx} e^{x} = e^{x}$
- $\dfrac{d}{dx} \sin x = \cos x$ e $\dfrac{d}{dx} \cos x = -\sin x$
- $\dfrac{d}{dx} \tan x = \sec^2 x$
- $\dfrac{d}{dx} e^{a x} = a\, e^{a x}$ e $\dfrac{d}{dx} \sin(a x) = a \cos(a x)$`,
  },
  {
    id: "integrais",
    titulo: "Integrais",
    texto: String.raw`Integrais indefinidas; acrescente a constante de integração. $a$ e $m$ são constantes.
- $\displaystyle\int x^m\,dx = \frac{x^{m+1}}{m+1}$, para $m \neq -1$
- $\displaystyle\int \frac{dx}{x} = \ln|x|$
- $\displaystyle\int e^{a x}\,dx = \frac{1}{a} e^{a x}$
- $\displaystyle\int \sin(a x)\,dx = -\frac{1}{a}\cos(a x)$ e $\displaystyle\int \cos(a x)\,dx = \frac{1}{a}\sin(a x)$
- $\displaystyle\int \sin^2 x\,dx = \frac{x}{2} - \frac{\sin 2x}{4}$
- $\displaystyle\int x\,e^{-a x}\,dx = -\frac{1}{a^2}(a x + 1)\,e^{-a x}$
- $\displaystyle\int \frac{dx}{a + b x} = \frac{1}{b}\ln|a + b x|$
- $\displaystyle\int \frac{dx}{(x^2 + a^2)^{3/2}} = \frac{x}{a^2\sqrt{x^2 + a^2}}$
- $\displaystyle\int \frac{x\,dx}{(x^2 + a^2)^{3/2}} = -\frac{1}{\sqrt{x^2 + a^2}}$
- $\displaystyle\int \frac{dx}{\sqrt{x^2 + a^2}} = \ln\left(x + \sqrt{x^2 + a^2}\right)$
- $\displaystyle\int_0^\infty x^n e^{-a x}\,dx = \frac{n!}{a^{n+1}}$, para $n$ inteiro $\ge 0$ e $a > 0$`,
  },
  {
    id: "series",
    titulo: "Séries e aproximações",
    texto: String.raw`### Binômio
$$(1 + x)^n = 1 + n x + \frac{n(n-1)}{2!}x^2 + \cdots \qquad (|x| < 1)$$
Para $|x| \ll 1$: $(1 + x)^n \approx 1 + n x$. Exemplo: $\sqrt{1 + x} \approx 1 + x/2$.
### Exponencial e logaritmo
$$e^x = 1 + x + \frac{x^2}{2!} + \frac{x^3}{3!} + \cdots$$
$$\ln(1 + x) = x - \frac{x^2}{2} + \frac{x^3}{3} - \cdots \qquad (|x| < 1)$$
### Seno, cosseno e tangente ($\theta$ em radianos)
$$\sin\theta = \theta - \frac{\theta^3}{3!} + \frac{\theta^5}{5!} - \cdots \qquad \cos\theta = 1 - \frac{\theta^2}{2!} + \frac{\theta^4}{4!} - \cdots$$
$$\tan\theta = \theta + \frac{\theta^3}{3} + \frac{2\theta^5}{15} + \cdots \qquad (|\theta| < \pi/2)$$
Para ângulos pequenos, $\sin\theta \approx \tan\theta \approx \theta$ e $\cos\theta \approx 1 - \theta^2/2$.
### Série de Taylor
$$f(x_0 + h) = f(x_0) + f'(x_0)\,h + \frac{f''(x_0)}{2!}h^2 + \cdots$$`,
  },
];
