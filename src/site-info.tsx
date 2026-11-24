import {PublicRetention} from "./retention";
import React from "react";

export const pages = {
  dokumentace: { title: "Jak používat Folio", sections: [
    ["Najdi zadání", "V knihovně vyber předmět. Na jeho úvodní stránce najdeš tři nejnovější úkoly. Starší zadání vyhledej podle názvu v příslušné vzdělávací oblasti. Soubory ke stažení najdeš přímo u zadání."],
    ["Připoj se ke kvízu", "Otevři odkaz nebo načti QR kód z projekce. Při ručním připojení zadej herní PIN. Zvol si přezdívku a avatar. Po spuštění hry odpovídej na svém zařízení. U otázek s více správnými možnostmi můžeš označit několik odpovědí."],
    ["Odevzdej zpětnou vazbu", "Načti QR kód dotazníku od učitele, vyplň otázky a odešli formulář. Do slovních odpovědí nepiš jména ani jiné údaje, podle kterých lze někoho poznat."],
    ["Připrav hodinu jako učitel", "V administraci otevři přidělený předmět a vyber oblast pro nový úkol. Zadání můžeš napsat nebo importovat z TXT a pak přiložit zdrojové soubory. U anonymního dotazníku vyber otázky, otevři sběr a promítni QR kód. Výsledky najdeš v detailu dotazníku. Po hodině můžeš sběr uzavřít."],
  ] },
  role: { title: "Role a oprávnění", sections: [
    ["Žák a návštěvník", "Kdokoli s odkazem může procházet zveřejněné materiály. Žák se připojí ke hře pomocí PINu nebo QR kódu a otevřený dotazník vyplní přes jeho odkaz."],
    ["Správce", "Správce upravuje obsah knihovny, vyhodnocuje kvízy a dotazníky a nastavuje uchovávání dat. Přístup do správy ověřuje Vercel."],
  ] },
  podminky: { title: "Podmínky používání", sections: [
    ["Použití při výuce", "Folio slouží ke sdílení učebních materiálů, hraní třídních kvízů a sběru zpětné vazby. Při práci respektuj zadání učitele a soukromí spolužáků. Zvol si přezdívku, která nikoho neuráží ani nenapodobuje."],
    ["Zveřejňování materiálů", "Vkládej jen obsah, který smíš zpřístupnit žákům. Respektuj autorství a licence jednotlivých souborů. Před zveřejněním zkontroluj i přílohy, zejména jména, kontakty a fotografie osob."],
    ["Používání přístupu", "Používej svůj účet a přidělená oprávnění. Pozvánky, odkazy k moderování a přístupové údaje předávej pouze určeným osobám. Nevkládej škodlivé soubory a nezasahuj do cizí hry nebo dotazníku."],
    ["Nevhodný obsah", "Pokud najdeš chybný, závadný nebo neoprávněně zveřejněný materiál, pošli správci odkaz na stránku a stručně popiš problém."],
  ] },
  bezpecnost: { title: "Bezpečnost a hlášení problémů", sections: [
    ["Veřejné odkazy", "Zveřejněné materiály může otevřít i někdo mimo třídu. Odkaz nebo QR kód k otevřenému dotazníku může příjemce předat dál. Po skončení sběru jej v administraci uzavři."],
    ["Sdílená zařízení", "Po práci na školním počítači ukonči přihlášení. Prohlížeč si pamatuje zvolený avatar a přístup k rozehrané hře. Vymazáním dat webu můžeš přijít o možnost vrátit se do hry pod stejnou přezdívkou."],
    ["Jak problém nahlásit", "Při podezření na cizí přístup, chybu v oprávněních nebo zveřejnění osobních údajů kontaktuj správce. Připoj adresu stránky bez přístupového tokenu, přibližný čas a popis situace. Neposílej hesla, pozvánky ani úplné odpovědi žáků."],
  ] },
  soukromi: { title: "Soukromí a sběr dat", sections: [
    ["Přístup ke správě", "Folio eviduje jméno a e-mail správce. Přístup do správy ověřuje Vercel. Žáci používají veřejný web."],
    ["Herní výsledky", "Pro průběh kvízu, bodování a historii výsledků aplikace ukládá přezdívku, avatar, čas připojení, odpovědi, časy odpovědí a získané body. Přezdívka a pořadí mohou být vidět třídě při projekci. Zvol si proto přezdívku bez celého jména."],
    ["Anonymní dotazníky", "Folio u odpovědi neukládá jméno ani školní účet. Volby sčítá po jednotlivých otázkách a slovní komentáře ukládá v jejich znění. Výsledky vidí autor dotazníku s oprávněním k předmětu a správce. Pokud se v komentáři podepíšeš, čtenáři tě mohou poznat."],
    ["Úložiště a prohlížeč", "Web běží na Vercelu. Záznamy aplikace jsou v databázi a nahrané soubory v soukromém úložišti Supabase. V prohlížeči zůstává avatar, klíč k návratu do hry a značka odeslání dotazníku. Pro rozpoznání opakovaného odeslání aplikace ukládá oddělený otisk náhodného klíče."],
    ["Uchovávání a žádosti", "Ukončení hry nebo uzavření dotazníku zachovává výsledky pro vyhodnocení. Pravidla pro výmaz výsledků a komentářů najdeš níže. Informace o právním základu poskytne správce. S dotazem na zpracování nebo žádostí o přístup, opravu, výmaz či omezení se obrať na správce. Rozsah práv závisí na okolnostech zpracování. Stížnost můžeš podat u Úřadu pro ochranu osobních údajů."],
  ] },
};
export type PageId = keyof typeof pages;
export function InfoPage({ id }: { id: PageId }) {
  const page = pages[id];
  return <main className="wrap page info-page"><a href="/">‹ Knihovna aktivit</a><h1>{page.title}</h1>
    {page.sections.map(([title,body]) => <section key={title}><h2>{title}</h2><p>{body}</p></section>)}
    {id === "soukromi" && <PublicRetention/>}
    {id === "soukromi" && <p><a href="https://uoou.gov.cz/">Úřad pro ochranu osobních údajů</a> · <a href="https://eur-lex.europa.eu/eli/reg/2016/679/oj?locale=cs">Obecné nařízení o ochraně osobních údajů</a></p>}
    <section><h2>Provozovatel a kontakt pro ochranu údajů</h2><address>Matěj Rindoš<br/><a href="mailto:mrindos@stavebkaji.cz">mrindos@stavebkaji.cz</a> · <a href="tel:+420731800724">731 800 724</a></address></section>
  </main>;
}
