import React, { useState } from "react";
import { api, useData, act } from "./api";
export function Login() {
  const [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  return (
    <main className="wrap page">
      <form
        className="panel stack"
        style={{ maxWidth: 480, margin: "2rem auto" }}
        onSubmit={async (e) => {
          e.preventDefault();
          const d = Object.fromEntries(new FormData(e.currentTarget));
          setBusy(true);
          setError("");
          try {
            await api("account/login", d);
            location.reload();
          } catch (e) {
            setError((e as Error).message);
          } finally {
            setBusy(false);
          }
        }}
      >
        <h1>Přihlášení do Folia</h1>
        <p>Pro učitele a správce školy.</p>
        <label>
          E-mail
          <input name="email" type="email" autoComplete="username" required />
        </label>
        <label>
          Heslo
          <input
            name="password"
            type="password"
            autoComplete="current-password"
            required
          />
        </label>
        {error && <p role="alert">{error}</p>}
        <button disabled={busy}>
          {busy ? "Přihlašování…" : "Přihlásit se"}
        </button>
        <a href="/">Veřejná knihovna</a>
      </form>
    </main>
  );
}
export function Accounts() {
  const { data: users, error } = useData("account/teachers");
  const { data: subjects } = useData("catalog?staff=1");
  return (
    <>
      <h1>Učitelé a oprávnění</h1>
      {error && <p role="alert">{error}</p>}
      {subjects && (
        <>
          <AccountForm subjects={subjects} />
          {users?.map((u: any) => (
            <AccountForm key={u.id} user={u} subjects={subjects} />
          ))}
        </>
      )}
    </>
  );
}
function AccountForm({ user, subjects }: { user?: any; subjects: any[] }) {
  const [busy, setBusy] = useState(false);
  return (
    <form
      className="panel stack"
      onSubmit={(e) => {
        e.preventDefault();
        const f = new FormData(e.currentTarget);
        act(async () => {
          setBusy(true);
          try {
            await api("account/teachers", {
              id: user?.id,
              name: f.get("name"),
              email: f.get("email"),
              password: f.get("password"),
              subjects: f.getAll("subjects"),
            });
            location.reload();
          } finally {
            setBusy(false);
          }
        })();
      }}
    >
      <h2>{user ? user.email : "Nový učitel"}</h2>
      <label>
        Jméno
        <input name="name" defaultValue={user?.name} required />
      </label>
      {!user && (
        <>
          <label>
            E-mail
            <input name="email" type="email" required />
          </label>
          <label>
            Počáteční heslo
            <input
              name="password"
              type="password"
              minLength={12}
              autoComplete="new-password"
              required
            />
          </label>
        </>
      )}
      <fieldset>
        <legend>Přidělené předměty</legend>
        {subjects.map((s) => (
          <label key={s.id} style={{ display: "block" }}>
            <input
              name="subjects"
              type="checkbox"
              value={s.id}
              defaultChecked={user?.subjects.includes(s.id)}
            />{" "}
            {s.title}
          </label>
        ))}
      </fieldset>
      <button disabled={busy}>
        {user ? "Uložit oprávnění" : "Vytvořit účet"}
      </button>
    </form>
  );
}
