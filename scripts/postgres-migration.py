"""Generate the PostgreSQL schema and the two service-only transactional RPCs."""
import json, sqlite3, re, pathlib
root = pathlib.Path(__file__).resolve().parents[1]
db = sqlite3.connect(':memory:')
db.executescript(json.loads((root/'lib/schema-sql.json').read_text()))
tables = [r[0] for r in db.execute("select name from sqlite_master where type='table'") if r[0] not in ('revision','sessions','verification')]
keys = {}
out = ['BEGIN;', 'CREATE SCHEMA folio;', 'REVOKE ALL ON SCHEMA folio FROM PUBLIC, anon, authenticated;']
for t in tables:
    items = list(db.execute('pragma table_info('+t+')'))
    keys[t] = [c[1] for c in sorted(items,key=lambda c:c[5]) if c[5]]
    ddl = db.execute("select sql from sqlite_master where name=?",(t,)).fetchone()[0]
    ddl = re.sub(r'^CREATE TABLE ', 'CREATE TABLE folio.', ddl, flags=re.I)
    ddl = re.sub(r'\bINTEGER\b','BIGINT',ddl,flags=re.I)
    ddl = re.sub(r'REFERENCES (\w+\(\w+\))',r'REFERENCES folio.\1 DEFERRABLE INITIALLY DEFERRED',ddl,flags=re.I)
    # 'at' is a column name in the original SQLite schema.
    out.append(ddl+';')
for (ddl,) in db.execute("select sql from sqlite_master where type='index' and sql is not null"):
    out.append(re.sub(r'\bON (\w+)', r'ON folio.\1', ddl, count=1, flags=re.I) + ';')
out.extend(["CREATE UNIQUE INDEX single_folio_admin ON folio.users (role) WHERE role='admin';", "INSERT INTO folio.users VALUES('folio-admin','mrindos@stavebkaji.cz','Matěj Rindoš','admin');"])
out+=['CREATE TABLE folio.clock(id boolean PRIMARY KEY CHECK(id), rev bigint NOT NULL);','INSERT INTO folio.clock VALUES(true,0);']
rls = [f'ALTER TABLE folio.{table} ENABLE ROW LEVEL SECURITY;' for table in [*tables, 'clock']]
out.extend(' '.join(rls[i:i+2]) for i in range(0, len(rls), 2))
snapshot = " || ".join("jsonb_build_object('%s',(SELECT coalesce(jsonb_agg(to_jsonb(t)),'[]'::jsonb) FROM folio.%s t))"%(t,t) for t in tables)
out.append('''CREATE FUNCTION public.folio_read(known bigint) RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = pg_catalog AS $$
 SELECT CASE WHEN rev=known THEN jsonb_build_object('rev',rev) ELSE jsonb_build_object('rev',rev,'tables', '''+snapshot+''') END FROM folio.clock WHERE id;
$$;''')
out.append('''CREATE FUNCTION public.folio_commit(expected bigint, changes jsonb) RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
BEGIN
 UPDATE folio.clock SET rev=rev+1 WHERE id AND rev=expected;
 IF NOT FOUND THEN RETURN false; END IF;''')
for t in reversed(tables):
    pred=' AND '.join('t."%s"=x."%s"'%(k,k) for k in keys[t])
    out.append(" IF changes ? '%s' THEN DELETE FROM folio.%s t USING jsonb_populate_recordset(NULL::folio.%s, changes->'%s'->'del') x WHERE %s; END IF;"%(t,t,t,t,pred))
for t in tables:
    cols = [c[1] for c in db.execute('pragma table_info('+t+')')]; upd = ', '.join('"%s"=EXCLUDED."%s"'%(c,c) for c in cols if c not in keys[t])
    action = 'DO UPDATE SET '+upd if upd else 'DO NOTHING'
    out.append(" IF changes ? '%s' THEN INSERT INTO folio.%s SELECT * FROM jsonb_populate_recordset(NULL::folio.%s, changes->'%s'->'put') ON CONFLICT (%s) %s; END IF;"%(t,t,t,t,','.join(keys[t]),action))
out+=[' RETURN true; END; $$;', 'REVOKE ALL ON FUNCTION public.folio_read(bigint), public.folio_commit(bigint,jsonb) FROM PUBLIC, anon, authenticated;', 'GRANT EXECUTE ON FUNCTION public.folio_read(bigint), public.folio_commit(bigint,jsonb) TO service_role;', "INSERT INTO storage.buckets(id,name,public,file_size_limit) VALUES('folio-files','folio-files',false,26214400);",'COMMIT;']
(root/'supabase/migrations/20261123000100_folio.sql').write_text('\n'.join(out)+'\n', encoding='utf-8')
(root/'lib/postgres-keys.json').write_text(json.dumps(keys))
