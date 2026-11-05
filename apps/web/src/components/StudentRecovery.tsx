import { useState, type FormEvent } from "react";
import { api } from "../api";

export default function StudentRecovery() {
  const [query, setQuery] = useState("");
  const [rows, setRows] = useState<{ id: number; nickname: string; created_at: string }[]>([]);
  const [selected, setSelected] = useState<number | null>(null);
  const [confirmed, setConfirmed] = useState(false);
  const [issued, setIssued] = useState<{ nickname: string; personal_code: string } | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function search(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    setRows([]);
    setSelected(null);
    setConfirmed(false);
    setIssued(null);
    try {
      setRows(await api.findStudents(query.trim()));
    } catch (err) { setError(err instanceof Error ? err.message : "Não foi possível buscar."); }
    finally { setBusy(false); }
  }
  async function issue() {
    if (!selected || !confirmed) return;
    setBusy(true);
    setError("");
    try { setIssued(await api.resetStudentCode(selected)); }
    catch (err) { setError(err instanceof Error ? err.message : "Não foi possível emitir."); }
    finally { setBusy(false); }
  }
  return (
    <section className="card stack" aria-labelledby="recovery-title">
      <h3 className="card-title" id="recovery-title">Ajudar aluno a recuperar o Edu</h3>
      <p className="notice">Uso privado dos tutores. Confirme presencialmente quem é o aluno; apelidos iguais não provam identidade. Emitir outro código encerra os acessos anteriores desse aluno.</p>
      <form className="stack" onSubmit={search}>
        <label htmlFor="find-student">Apelido exato do aluno</label>
        <input id="find-student" value={query} minLength={2} maxLength={16} required autoComplete="off" onChange={(e) => setQuery(e.target.value)} />
        <button className="btn ghost" disabled={busy}>Buscar perfil do aluno</button>
      </form>
      {rows.length > 0 && !issued && <>
        <fieldset className="stack">
          <legend>Escolha o perfil confirmado</legend>
          {rows.map((row) => <label key={row.id} className="row">
            <input type="radio" name="student-profile" checked={selected === row.id} onChange={() => { setSelected(row.id); setConfirmed(false); }} />
            {row.nickname} · perfil {row.id} · criado em {new Date(row.created_at).toLocaleDateString("pt-BR")}
          </label>)}
        </fieldset>
        <label className="row">
          <input type="checkbox" checked={confirmed} onChange={(e) => setConfirmed(e.target.checked)} />
          Identifiquei o aluno presencialmente e confirmei o perfil
        </label>
        <button className="btn" disabled={!selected || !confirmed || busy} onClick={() => void issue()}>Emitir novo código pessoal</button>
      </>}
      {issued && <div className="stack">
        <p>Código de {issued.nickname}. Entregue apenas ao aluno identificado; ele só aparece nesta emissão.</p>
        <output className="personal-code" aria-label="Novo código pessoal">{issued.personal_code}</output>
        <button className="btn ghost" onClick={() => { setIssued(null); setRows([]); }}>Entreguei o código · ocultar</button>
      </div>}
      {error && <div className="error" role="alert">{error}</div>}
    </section>
  );
}
