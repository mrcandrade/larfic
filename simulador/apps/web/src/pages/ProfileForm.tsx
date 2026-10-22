import { useState } from "react";
import { backend, saveProfile, saveSession, type Profile } from "../account.ts";

/** Identificação do aluno/professor. Com backend, oferece login por código enviado ao e-mail. */
export function ProfileForm({ initial, onDone, askRole }: { initial?: Profile | null; onDone?(p: Profile): void; askRole?: boolean }) {
  const [name, setName] = useState(initial?.name ?? "");
  const [matricula, setMatricula] = useState(initial?.matricula ?? "");
  const [role, setRole] = useState<Profile["role"]>(initial?.role ?? "aluno");
  const [email, setEmail] = useState(initial?.email ?? "");
  const [code, setCode] = useState("");
  const [stage, setStage] = useState<"form" | "code">("form");
  const [msg, setMsg] = useState("");

  const finish = () => {
    const p: Profile = { name: name.trim(), matricula: matricula.trim(), role, email: email.trim() || undefined };
    saveProfile(p);
    onDone?.(p);
  };

  return (
    <form
      className="profile-form"
      onSubmit={async (e) => {
        e.preventDefault();
        if (!name.trim() || !matricula.trim()) return setMsg("Preencha nome e matrícula.");
        if (backend && email.trim() && stage === "form") {
          try {
            await backend.sendCode(email.trim());
            setStage("code");
            setMsg("Enviamos um código para o seu e-mail.");
          } catch (err) {
            setMsg(`Não foi possível enviar o código: ${(err as Error).message}`);
          }
          return;
        }
        if (backend && stage === "code") {
          try {
            saveSession(await backend.verifyCode(email.trim(), code.trim()));
            await backend.upsert("profiles", { id: backend.session!.user.id, name: name.trim(), matricula: matricula.trim() }, "id").catch(() => undefined);
          } catch (err) {
            return setMsg(`Código inválido: ${(err as Error).message}`);
          }
        }
        finish();
      }}
    >
      <h2>Identificação</h2>
      <label>
        Nome completo
        <input value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" />
      </label>
      <label>
        Matrícula (ou cartão UFRGS)
        <input value={matricula} onChange={(e) => setMatricula(e.target.value)} inputMode="numeric" />
      </label>
      {askRole && (
        <label>
          Sou
          <select value={role} onChange={(e) => setRole(e.target.value as Profile["role"])}>
            <option value="aluno">Aluno(a)</option>
            <option value="professor">Professor(a)</option>
          </select>
        </label>
      )}
      {backend && (
        <label>
          E-mail institucional (para entrar na sua conta; opcional)
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" />
        </label>
      )}
      {stage === "code" && (
        <label>
          Código recebido
          <input value={code} onChange={(e) => setCode(e.target.value)} inputMode="numeric" autoComplete="one-time-code" />
        </label>
      )}
      <button type="submit" className="fl-primary">
        {stage === "code" ? "Entrar" : backend && email ? "Enviar código" : "Salvar"}
      </button>
      {msg && <p className="fl-muted">{msg}</p>}
      {!backend && <p className="fl-muted">Seus dados ficam só neste navegador. Eles identificam seus envios para o professor.</p>}
    </form>
  );
}
