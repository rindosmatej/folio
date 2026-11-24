# Folio – Supabase Auth a PostgreSQL

Tato verze nahrazuje automatickou identitu správce skutečným přihlášením. Žáci nadále nepotřebují účet. Server ověřuje přístupový token u Supabase Auth a používá HttpOnly cookie (v produkci Secure). Relace vyprší nejpozději po hodině; potom je potřeba nové přihlášení. Obnovení hesla a automatické obnovení relace nejsou v této verzi implementovány.

## 1. Databáze a správce

Pokud již existuje schéma `folio` a bucket `folio-files`, původní migraci znovu nespouštějte. Pro novou databázi použijte `supabase/migrations/20261123000100_folio.sql` v Supabase SQL Editoru. Stávající identifikátor `folio-admin` zůstává zachován kvůli vazbám na obsah a soutěže. Nová SQL migrace není nutná. Při prvním otevření prázdné databáze se zavede původní ukázkový obsah.

V Supabase Authentication → Users vytvořte administrátora s potvrzeným e-mailem (použijte původní administrátorský e-mail). Zkopírujte jeho skutečné UUID. V Authentication vypněte veřejnou registraci nových účtů. Účty učitelů vytváří správce v aplikaci přes serverové Supabase Admin API.

## 2. Lokální nastavení

Zachovejte svůj stávající `.env` nebo `.env.local`, přidejte dvě nové hodnoty. Pozor, `.env.local` má při načítání přednost a dříve nastavené proměnné PowerShellu mohou překrýt soubory. Ideálně otevřete nový terminál.

```env
SUPABASE_URL=https://VAS-PROJEKT.supabase.co
SUPABASE_SERVER_KEY=VAS_SERVICE_ROLE_KEY
SUPABASE_ANON_KEY=VAS_ANON_NEBO_PUBLISHABLE_KEY
FOLIO_ADMIN_AUTH_ID=UUID_UCTU_SPRAVCE
FOLIO_MODE=admin
```

Serverový klíč je tajný; doporučujeme legacy service_role pro kompatibilitu s Auth Admin REST API. Nikdy jej neukládejte do Git. Název `SUPABASE_ANON_KEY` přijímá i nový publishable klíč. Ujistěte se, že veřejný a serverový klíč jsou ze stejného projektu.

Node.js 22, ve složce projektu:

```powershell
npm ci
npm run check
npm run dev
```

Otevřete `http://localhost:3000/ucitel`. Přihlaste se e-mailem a heslem. Bez Supabase zůstane lokální databáze dostupná pro veřejný obsah, ale bez administrátorského přihlášení.

## 3. Učitelé

V administraci otevřete Učitelé. Zadejte jméno, e-mail, počáteční heslo (min. 12 znaků) a přidělte předměty. Přidělení lze měnit. Oprávnění jsou uložena v serverově spravovaných `app_metadata` Supabase Auth, nikoli v uživatelsky editovatelných metadatech. Učitelský profil se při prvním přístupu zapíše do existující `folio.users`. Učitel může spravovat obsah přidělených předmětů, nikoli účty nebo globální nastavení. Odebrání všech předmětů odebere přístup k jejich správě, ale nezablokuje účet. Blokování účtu a změny hesla řešte v Supabase Dashboardu. Počáteční heslo předávejte bezpečně.

## 4. Vercel

Lze použít jediný projekt: nastavte obě `FOLIO_PUBLIC_ORIGIN` a `FOLIO_ADMIN_ORIGIN` na stejnou skutečnou HTTPS doménu bez koncového lomítka, `FOLIO_MODE=admin` a všechny čtyři hodnoty Supabase/Auth z předchozího kroku. Vercel použije Node.js 22 a stávající `vercel.json`. Veřejnou knihovnu ani účast žáků neuzamykejte Vercel Authentication. Případnou původní ochranu Vercelu odstraňte až po úspěšném ověření aplikace a oprávnění.

Původní konfigurace se dvěma adresami je také možná: na veřejném projektu `FOLIO_MODE=public`, na učitelském `FOLIO_MODE=admin`, obě adresy nastavené shodně na obou projektech. Přihlašování probíhá jen na učitelské adrese.

## 5. Kontroly před nasazením

`npm run check`, `npm run build`, `npm test`, `node --test scripts/test-auth.mjs`. Otestujte i skutečné připojení k Supabase: anonymní `/api/me` vrací `null`, `/api/catalog?staff=1` vrací 401, anonymní POST pro úpravy nesmí projít; po přihlášení správce může tvořit obsah a účty, učitel vidí pouze přidělené předměty a nemůže spravovat účty ani cizí předměty. Ověřte odhlášení, odebrání oprávnění, přílohy, QR a soutěže z druhého prohlížeče. Tato verze byla připravena ze zdrojů bez živého přístupu k vašemu Supabase; úplné integrační testy proveďte před veřejným nasazením.
