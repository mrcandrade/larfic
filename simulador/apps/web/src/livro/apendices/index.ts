/** Apêndices do livro (A a G), na ordem do sumário. */
export interface Apendice {
  id: "a" | "b" | "c" | "d" | "e" | "f" | "g";
  letra: string;
  titulo: string;
  resumo: string;
}

export const apendices: Apendice[] = [
  { id: "a", letra: "A", titulo: "O Sistema Internacional de Unidades (SI)", resumo: "Unidades de base, unidades derivadas e prefixos." },
  { id: "b", letra: "B", titulo: "Algumas Constantes Fundamentais da Física", resumo: "Valores exatos do SI de 2019 e valores do CODATA 2022." },
  { id: "c", letra: "C", titulo: "Alguns Dados Astronômicos", resumo: "Sol, Terra, Lua e planetas." },
  { id: "d", letra: "D", titulo: "Fatores de Conversão", resumo: "Tabelas e um conversor interativo." },
  { id: "e", letra: "E", titulo: "Fórmulas Matemáticas", resumo: "Geometria, trigonometria, derivadas, integrais, vetores e séries." },
  { id: "f", letra: "F", titulo: "Propriedades dos Elementos", resumo: "Os 118 elementos: massa molar, densidade, fusão e ebulição." },
  { id: "g", letra: "G", titulo: "Tabela Periódica dos Elementos", resumo: "Tabela interativa, com cores por família." },
];

export const findApendice = (id: string) => apendices.find((a) => a.id === id.toLowerCase());
