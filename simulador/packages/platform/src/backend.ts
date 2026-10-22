// Cliente mínimo do Supabase (Auth + PostgREST) com fetch, sem dependências.
// Sem configuração, o app funciona em modo local (perfil e progresso só no navegador).

export interface BackendConfig {
  url: string;
  anonKey: string;
}

export interface Session {
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
  user: { id: string; email?: string };
}

export class Backend {
  session: Session | null = null;
  constructor(
    readonly cfg: BackendConfig,
    private readonly fetchFn: typeof fetch = (...a) => fetch(...a),
  ) {}

  private headers(extra: Record<string, string> = {}): Record<string, string> {
    return { apikey: this.cfg.anonKey, authorization: `Bearer ${this.session?.accessToken ?? this.cfg.anonKey}`, "content-type": "application/json", ...extra };
  }

  private async call<T>(path: string, init: RequestInit & { headers?: Record<string, string> } = {}): Promise<T> {
    const r = await this.fetchFn(`${this.cfg.url}${path}`, { ...init, headers: this.headers(init.headers) });
    const text = await r.text();
    const body = text ? (JSON.parse(text) as unknown) : null;
    if (!r.ok) throw new Error((body as { msg?: string; message?: string } | null)?.msg ?? (body as { message?: string } | null)?.message ?? `HTTP ${r.status}`);
    return body as T;
  }

  /** Envia código de acesso por e-mail (login sem senha). */
  sendCode(email: string): Promise<unknown> {
    return this.call("/auth/v1/otp", { method: "POST", body: JSON.stringify({ email, create_user: true }) });
  }

  async verifyCode(email: string, token: string): Promise<Session> {
    const r = await this.call<{ access_token: string; refresh_token: string; expires_in: number; user: { id: string; email?: string } }>("/auth/v1/verify", {
      method: "POST",
      body: JSON.stringify({ type: "email", email, token }),
    });
    this.session = { accessToken: r.access_token, refreshToken: r.refresh_token, expiresAt: Date.now() / 1000 + r.expires_in, user: r.user };
    return this.session;
  }

  async refresh(): Promise<Session | null> {
    if (!this.session) return null;
    const r = await this.call<{ access_token: string; refresh_token: string; expires_in: number; user: { id: string; email?: string } }>("/auth/v1/token?grant_type=refresh_token", {
      method: "POST",
      body: JSON.stringify({ refresh_token: this.session.refreshToken }),
    });
    this.session = { accessToken: r.access_token, refreshToken: r.refresh_token, expiresAt: Date.now() / 1000 + r.expires_in, user: r.user };
    return this.session;
  }

  signOut() {
    this.session = null;
  }

  select<T>(table: string, query = "select=*"): Promise<T[]> {
    return this.call<T[]>(`/rest/v1/${table}?${query}`);
  }

  insert<T>(table: string, rows: object | object[]): Promise<T[]> {
    return this.call<T[]>(`/rest/v1/${table}`, { method: "POST", body: JSON.stringify(rows), headers: { prefer: "return=representation" } });
  }

  upsert<T>(table: string, rows: object | object[], onConflict: string): Promise<T[]> {
    return this.call<T[]>(`/rest/v1/${table}?on_conflict=${onConflict}`, {
      method: "POST",
      body: JSON.stringify(rows),
      headers: { prefer: "return=representation,resolution=merge-duplicates" },
    });
  }

  fnUrl(name: string): string {
    return `${this.cfg.url}/functions/v1/${name}`;
  }
}
