# Megnézendő filmek és sorozatok – felhasználói leírás

Az app minden funkciója témák szerint: mit tud, hol találod, hogyan használd.
Minden új fejlesztés után bővül; a legutóbbi változások a végén, a **Változásnaplóban**.

Utolsó frissítés: 2026. 10. 04. · Élő oldal: https://filmlista-six.vercel.app/

> Tipp: VS Code-ban a **Ctrl+Shift+V** formázott előnézetben nyitja meg ezt a leírást.

## Tartalom

1. [Belépés és telepítés](#1-belépés-és-telepítés)
2. [A lista: nézetek és lapozás](#2-a-lista-nézetek-és-lapozás)
3. [Szűrés, keresés, rendezés](#3-szűrés-keresés-rendezés)
4. [Címek felvétele](#4-címek-felvétele)
5. [Egy cím adatlapja és szerkesztése](#5-egy-cím-adatlapja-és-szerkesztése)
6. [Állapotok, letöltve, értékelések](#6-állapotok-letöltve-értékelések)
7. [Sorozatok és évadok](#7-sorozatok-és-évadok)
8. [Még meg nem jelent filmek](#8-még-meg-nem-jelent-filmek)
9. [Franchise-ok és gyűjtemények](#9-franchise-ok-és-gyűjtemények)
10. [Mama-jelölések](#10-mama-jelölések)
11. [Értesítések](#11-értesítések)
12. [IMDb](#12-imdb)
13. [Statisztika](#13-statisztika)
14. [Mentések és adatbiztonság](#14-mentések-és-adatbiztonság)
15. [Telefonon](#15-telefonon)
16. [Billentyűzet, kényelmi apróságok](#16-billentyűzet-kényelmi-apróságok)
17. [Honnan jönnek az adatok?](#17-honnan-jönnek-az-adatok)
18. [Változásnapló](#18-változásnapló)

---

## 1. Belépés és telepítés

**Belépés:** e-mail-cím és jelszó. Regisztráció nincs, új fiókot csak a Supabase felületén
lehet létrehozni. A böngésző megjegyzi a belépést, nem kell minden alkalommal újra belépni.
**Kilépés:** a fejlécben, az e-mail-címed mellett.

**Telepítés saját ablakos alkalmazásként:**
- *Számítógépen (Chrome / Edge):* a címsor jobb szélén a „Telepítés” ikon → a Start menüben és
  a tálcán saját ikonnal (sötét alapon türkiz filmcsapó) indul, böngészősáv nélkül.
- *Telefonon:* a böngésző menüjében „Hozzáadás a kezdőképernyőhöz”.
- A telepített app ikonján egy szám mutatja az olvasatlan értesítéseket (ahol a rendszer
  támogatja).

## 2. A lista: nézetek és lapozás

A fejlécben: **Cím hozzáadása**, a **harang** (értesítések), az e-mail-címed, **Kilépés** és a
**⋮ További műveletek** menü (IMDb értékelések, Statisztika, Tömeges import, Mentés letöltése,
Mentések).

**Két nézet:**
- **Lista (táblázat)** – csak széles képernyőn (legalább 1400 px). Soronként: borító, cím
  (az eredeti címmel, évvel, IMDb-értékkel, műfajokkal), franchise, a TMDB leírása, Letöltve,
  Állapot, Mama, Saját értékelés és a kuka. Szinte minden közvetlenül a sorban állítható (lásd
  [5.](#5-egy-cím-adatlapja-és-szerkesztése)).
- **Rács (borítófal)** – nagy borítók kártyákon; 1400 px alatt mindig ez látszik.
- A kettő között a szűrősor jobb szélén lévő két ikongomb vált. A böngésző megjegyzi a
  választást.

**Lapozás:** 25 cím oldalanként. Szűrés, rendezés vagy keresés változásakor az 1. oldalra
ugrik; lapozáskor a lista tetejére görget.

**A borítókártyán:** borító (rámutatva a borító színében fénylik), cím (rákattintva az IMDb-
adatlap nyílik, ha nincs IMDb-azonosító, a TMDB-é), eredeti cím, év, típus, IMDb-érték,
műfajok színes pöttyel, „Mama: …”, a saját értékelés kis csillagokkal, „Hozzáadva: <dátum>”,
a borító sarkában „Letöltve” jelvény. A borítóra kattintva az adatlap nyílik.

**Betöltés közben** a lista helyén halványan csillogó „csontváz” látszik.

## 3. Szűrés, keresés, rendezés

**A szűrősor balról jobbra:**

| Szűrő | Lehetőségek |
|---|---|
| Típus | Filmek / Sorozatok (franchise-ra szűrve vagy keresés közben: Filmek és sorozatok is) |
| Állapot | Mind · Megnézendő · Folyamatban · Megnézve · Abbahagyva (ez csak sorozatoknál) – mindegyik mellett a darabszám, ami a többi szűrőt is figyelembe veszi |
| Letöltés | Összes / Letöltött / Nem letöltött |
| Műfaj | az adott típus műfajai |
| Mama | Összes / Érdekli / Megkapta (csak ha van Mama-jelölés) |
| Franchise | Összes / Franchise nélkül / a franchise-aid logóval |

**Alapállapot** (betöltéskor és a **↺** gombbal): Filmek – Megnézendő – Nem letöltött – Összes
műfaj – Franchise nélkül. Ha valamelyik szűrő eltér ettől, a ↺ gomb élénk; alapállapotban
halvány.

**Keresés a listán** (a szűrősor jobb oldalán): a címben és az eredeti címben keres, kis- és
nagybetűtől, ékezettől függetlenül; több szónál mindegyiknek szerepelnie kell. Gépelés közben
az **egész listán** keres (a szűrők félreállnak, de közben szűkítheted őket); a keresés
törlésekor a korábbi szűrők visszaállnak.

**Rendezés** (a kereső melletti lenyíló): Legutóbb hozzáadott · Legkorábban hozzáadott · Legjobb
saját értékelés · Legjobb IMDb-értékelés · Legújabb megjelenés · Legrégebbi megjelenés. Az
érték nélküli címek a végére kerülnek.

**Letapadó szűrősor:** lefelé görgetéskor a szűrősor a képernyő tetején marad (áttetsző
üveghatással). Asztalon ilyenkor két gyorsgomb is megjelenik mellette: **+** (Cím hozzáadása)
és **↑** (vissza a lap tetejére).

**A most szerkesztett cím a helyén marad:** ha egy címet úgy módosítasz, hogy már nem illik a
szűrőbe (pl. „Nem letöltött” nézetben letöltöttnek jelölöd), nem tűnik el azonnal, így
visszavonhatod. A szűrés következő változásakor kerül le.

**Ha nincs találat**, az üres oldalon ajánlott lépések: „Szűrők törlése”, „Felfedezés”;
keresésnél „Keresés a TMDB-n: „…”” (a Cím hozzáadása panel a beírt szöveggel nyílik) és
„Keresés törlése”.

## 4. Címek felvétele

**Cím hozzáadása panel** (fejléc gomb; telefonon a jobb alsó sarokban lévő kerek **+**):
- Kezdd el gépelni a címet (pl. „Dűne”) – rövid szünet után megjelennek a TMDB találatai
  borítóval, évvel, típussal. **Hozzáadás a listához**; a már listán lévőknél „✓ A listán”.
- Felvételkor a cím megkapja: magyar címet és leírást (ha nincs magyar, angolt), műfajokat,
  borítót, háttérképet, IMDb-értékelést, sorozatnál az évadokat, filmnél a megjelenési
  dátumokat.

**Felfedezés** (a panelben, amíg a keresőmező üres): négy vízszintes borítósor – *Most a
mozikban*, *Hamarosan a mozikban* (dátummal), *Új digitálisan*, *Népszerű sorozatok* – egy
kattintással („+ Hozzáadás”) a listára. Csak a valószínűleg **magyar szinkronos** címek:
Magyarországon megjelent (sorozatnál magyar streamingen elérhető), angol vagy magyar nyelvű,
magyar leírással; dokumentum-, valóság- és talkshow nélkül.

**Hasonló címek** – minden adatlap alján (lásd [5.](#5-egy-cím-adatlapja-és-szerkesztése)),
„+ Hozzáadás” gombbal.

**Tömeges import** (⋮ menü, csak széles képernyőn):
1. Soronként egy cím, legfeljebb 150. A sor végére írt évszám pontosít (pl. „Dűne 2021” vagy
   „A sötét lovag (2008)”); az ismétlődő sorok egyszer számítanak.
2. **Keresés** – a biztos (pontosan egyező) találatok előre ki vannak jelölve; a
   bizonytalanoknál borítós választó („Másik találat”), alapból „Kihagyás”. A már listán lévők
   kimaradnak.
3. **„N cím felvétele”** – a sikertelen sorok a szövegmezőben maradnak, újrapróbálhatók.

**Franchise hiányzó részei** – a gyűjtemény ablakából egy kattintással (lásd
[9.](#9-franchise-ok-és-gyűjtemények)).

## 5. Egy cím adatlapja és szerkesztése

**Megnyitás:** a borítóra kattintva (kártyán és listasorban is), vagy a kártya bal felső
sarkában lévő ceruzával. Asztalon a borító „átsiklik” az ablak nagy borítójának helyére.

**Mit látsz az adatlapon:**
- felül a film széles jelenetképe (ha van), asztalon (900 px fölött) balra nagy borító;
- cím, év, típus, IMDb-érték, a még meg nem jelent filmeknél dátumos jelvény;
- **Előzetes megnézése** (ha van; angol előzetesnél „angolul” jelzés) – az ablakban játssza le,
  „Előzetes bezárása”;
- a TMDB leírása;
- **Franchise**, **Állapot**, **Letöltve**, **Mama**, **Saját értékelés** (10 csillag);
- sorozatnál az állapot helyett az **évadok** (lásd [7.](#7-sorozatok-és-évadok));
- alul **Hasonló címek**: a TMDB ajánlásai vízszintes sorban (borítóra kattintva a TMDB-
  adatlap), „+ Hozzáadás” / „✓ A listán”. Becsukható; a böngésző megjegyzi (telefonon mindig
  csukva indul).
- Az ablak a borító színében dereng.

**Mentés és bezárás:** **Mentés** (a módosítások mentése), **Mégse** vagy **Esc** (bezárás
mentés nélkül). Telefonon az ablak alulról felcsúszó lap – a tetején lévő fogantyút lefelé
húzva bezárul.

**Törlés az adatlapról:** „Törlés” → megerősítés → a cím lekerül, és alul 8 másodpercig
**Visszavonás** gomb látszik.

**Szerkesztés közvetlenül a listasorban** (lista nézet): Letöltve pipa, Állapot és Mama
lenyíló, csillagok, franchise lenyíló (üresen csak rámutatáskor látszik), a sor végén kuka.
Minden **azonnal mentődik**; hiba esetén visszaáll az előző érték.
A **kukával** megerősítés nélkül lekerül a cím – 8 másodpercig **Visszavonás**. A végleges
törlés csak ezután történik meg (ha közben bezárod az oldalt, a cím megmarad).

## 6. Állapotok, letöltve, értékelések

**Állapotok:**
- **Megnézendő** – az alapállapot; a soron / kártyán **nem jelenik meg** felirat és szín
  (csak a szűrő nevezi meg).
- **Folyamatban** – türkiz.
- **Megnézve** – zöld; a cím **háttérbe húzódik**: fekete-fehér, fakó borító, tompított szöveg
  (rámutatva teljes színű).
- **Abbahagyva** – halvány lila, csak sorozatnál (lásd [7.](#7-sorozatok-és-évadok)); ugyanúgy
  háttérbe húzódik.
- Az adatlapon a kiválasztott állapotra újra kattintva visszaáll Megnézendőre.
- **A megnézés napja:** amikor egy címet Megnézve-re állítasz, az app a háttérben megjegyzi a
  napot (a felületen nem látszik, nem kell beírni). A Statisztika havi kimutatása és a CSV-
  mentés ebből dolgozik; a korábban importált, dátum nélküli megnézett címek ezekben nem
  szerepelnek.

**Letöltve:** pipa. Amikor egy cím **Megnézve** állapotba kerül, a pipa magától lekerül (ha
utána újra bepipálod, megmarad).

**Saját értékelés:** 1–10 csillag (borostyánszínű). Ugyanarra a csillagra újra kattintva (vagy
az adatlapon a „Törlés” linkkel) törlődik. A csillagok nyilakkal is állíthatók.

**„Hogy tetszett?”** – ha a listában Megnézve-re állítasz egy még nem értékelt címet, alul
megjelenik egy sáv csillagsorral; egy kattintással értékelhetsz, vagy „Később”.

**IMDb-értékelés:** „IMDb 8,0” jelvény (rámutatva a szavazatok száma) – lásd [12.](#12-imdb).

## 7. Sorozatok és évadok

**Évadok az adatlapon:** évadonként saját állapot (Folyamatban / Megnézve) és **Letöltve**
pipa. Gombok: **Mind megnézve**, **Nem nézem tovább** / **Mégis folytatom**, **+ Évad
hozzáadása**, **Utolsó évad törlése** (megerősítéssel). Az évadok változása **azonnal
mentődik**, nem kell a Mentés gomb.

- Ha egy évadot megnézettre állítasz, az előtte lévő üres évadok is megnézettek lesznek –
  10 másodpercig **Visszavonás**.
- **A sorozat állapota az évadokból számolódik:** minden megjelent évad megnézve → Megnézve;
  van megkezdett vagy megnézett évad → Folyamatban; különben Megnézendő. Letöltve = van
  letöltött évad.
- A **bejelentett** (jövőbeli vagy dátum nélküli) évad szaggatott, nem jelölhető, és nem számít
  bele a „mind megnézve” feltételbe.
- **Abbahagyva** („Nem nézem tovább”): a sorozat a listán marad, de háttérbe húzódik; az
  adatlapon az évadlista tetején lila sáv jelzi. Új évad sem írja felül. A „Mind megnézve” feloldja (Megnézve lesz),
  a „Mégis folytatom” után újra az évadokból számolódik.
- Ha törölsz egy évadot, ami a TMDB-n szerepel, a heti frissítés üresen visszahozza.

**Évadok idővonala** (az adatlapon, legalább 2 évadnál): évadonként egy pötty a megjelenés
napján, az állapot színével; a bejelentett szaggatott, a „ma” jelölve. A pöttyre kattintva a
lista az adott évadhoz görget.

**A listában:** az Állapot cellában évadcsík (évadonként egy szakasz); egy szakaszra kattintva
lép: üres → Folyamatban → Megnézve → üres. Az „x/y évad” feliratra kattintva lenyíló panel nyílik
az évadokkal. A Letöltve cellában a letöltött évadok számai. **A kártyán:** a borító alján az
évadcsík és az „x/y évad”.

**Új évadok automatikusan:** az app hetente megnézi a TMDB-n a sorozataidat; az új (megjelent
vagy bejelentett) évad magától felkerül, és a harang szól róla (lásd
[11.](#11-értesítések)). Epizódszintű követés nincs.

## 8. Még meg nem jelent filmek

A listán lévő, még meg nem jelent filmek **szaggatott kerettel** válnak el a borító körül, és
**dátumos jelvényt** kapnak (kártyán, listasorban, adatlapon):
- **„Hamarosan · okt. 16.”** – még a moziba sem került (vagy csak digitálisan jön); ha csak az
  éve ismert: „Hamarosan · 2027”.
- **„Moziban · digitálisan: okt. 29.”** – moziban fut, letölteni még nem lehet; ha nincs ismert
  dátum: „digitálisan: még nincs dátum”.
- Telefonon a kártyán csak a dátum („okt. 16.”) vagy „Moziban” látszik.
- Amint a film digitálisan megjelent, a keret és a jelvény eltűnik, és a **harang szól**:
  „Digitálisan is megjelent – már letölthető”.
- A dátumokat az app a háttérben, 3 naponta frissíti a TMDB-ről (előbb a magyarországi, ha
  nincs, az amerikai megjelenés). A megnézett filmeknél nincs jelölés.

## 9. Franchise-ok és gyűjtemények

**Franchise beállítása:** az adatlapon a Franchise mezőben, vagy a listasorban a franchise
lenyílóban. Lehetőségek:
- a meglévő franchise-aid;
- **„+ Új franchise…”** – ott helyben beírod a nevet (Enter: hozzáadás, Esc: mégse);
- **„✎ „Név” átnevezése…”** – helyben, a régi névvel kitöltve (Enter: mentés);
- **„× „Név” törlése…”** – megerősítés után minden címről lekerül.

**Franchise-szűrő** logókkal: a logót az app magától keresi a franchise első filmjéhez (a sötét
logók fehérre színezve). Franchise-ra szűrve a típus „Filmek és sorozatok” lesz.

**Gyűjtemény sáv:** franchise-ra szűrve a lista fölött: logó, mérő (megnézve zöld, listán
türkiz) és „x/y megnézve · n a listán · m hiányzik”. A **Gyűjtemény** gomb ablakot nyit:
- szakaszonként a franchise filmjeinek **minden TMDB-gyűjteménye**, a részek megjelenési
  sorrendben, sorszámmal; a megnézettek szürkék a saját értékeléssel, a listán lévők „A
  listán”, a **hiányzók szaggatott kerettel „+ Hozzáadás”** gombbal (a franchise-t is
  megkapják), vagy egyszerre: **„A hiányzó N felvétele”**;
- **„A franchise-od további címei”**: ami egyik gyűjteményben sincs (pl. sorozatok);
- **„+ TMDB-gyűjtemény hozzáadása”**: kézzel hozzárendelhető gyűjtemény (keresés – magyarul
  gyakran nincs találat, angolul igen, pl. „Star Wars”) → **Hozzárendelés**; a kézzel
  hozzárendelt szakasznál **Eltávolítás**.

## 10. Mama-jelölések

Jelölheted, melyik cím érdekli Mamát, és mit kapott már meg:
- **Érdekli** / **Megkapta** – borostyánszínnel. Az adatlapon gombként (újra kattintva
  törlődik), a listasorban lenyílóval; a kártyán „Mama: …” felirat.
- **Mama-szűrő** (Összes / Érdekli / Megkapta) – akkor jelenik meg, ha van legalább egy jelölés.

## 11. Értesítések

**Harang a fejlécben** – az olvasatlan értesítések száma borostyán jelvényben; ha nő a szám, a
harang egyszer megrezzen. Kinyitva a legutóbbi 30, borítóval:
- „Bejelentették a 4. évadot – várható: <dátum>”
- „Megjelent az 5. évad”
- „Digitálisan is megjelent – már letölthető” (film)

Kinyitáskor mind olvasott lesz. Egy értesítésre kattintva a cím adatlapja nyílik. Kívülre
kattintva vagy Esc-re bezárul.

**Értesítősáv alul középen:** rövid üzenetek, pl. „Visszavonás” a törlés után, „Hogy tetszett?”.
8 másodperc után eltűnik (a fogyó csík mutatja); rámutatva megáll; × gombbal bezárható.

## 12. IMDb

**IMDb-értékelés automatikusan:** minden címnél „IMDb 8,0” jelvény; az app kéthetente frissíti.
Ezek szerint is rendezhetsz („Legjobb IMDb-értékelés”).

**Saját IMDb-csillagaid átvétele** (⋮ menü → **IMDb értékelések**):
1. Az IMDb-n a saját értékeléseid oldalán (*Your Ratings*) töltsd le az exportot (CSV-fájl).
2. Az appban: ⋮ → IMDb értékelések → válaszd ki a fájlt.
3. Összefoglaló: hány értékelés van a fájlban, ebből mi változik a listádon.
4. **Értékelések beírása.**

Szabályok: csak a listán már szereplő címek (IMDb-azonosító alapján), az IMDb-csillag felülírja
a sajátot, az állapot nem változik, új cím nem kerül fel. Teljesen automatikus szinkron nincs (az
IMDb-nek nincs erre nyilvános felülete).

## 13. Statisztika

⋮ menü → **Statisztika** – a listádból számolt csempék:
- Megnézve az utolsó 12 hónapban
- Havonta megnézett címek (oszlopdiagram, a megnézés napja alapján – lásd [6.](#6-állapotok-letöltve-értékelések))
- Műfajok a listán (a műfajszínekkel)
- Értékelések (saját és IMDb-átlag)
- Letöltve, még nem láttad
- Legtöbb cím franchise-onként
- Folyamatban lévő sorozatok (évadhaladás)

## 14. Mentések és adatbiztonság

**Automatikus heti mentés:** hétfőnként hajnalban mentés készül a listádról (címek,
franchise-ok, évadok, értesítések); a 8 hétnél régebbiek törlődnek.

**⋮ menü → Mentések:**
- a mentések listája: dátum, fajta (*Heti* / *Kézi* / *Visszaállítás előtt* / *Feltöltött*),
  címek száma;
- **Mentés most** – azonnali mentés (pl. nagyobb átrendezés előtt);
- **Visszaállítás** – megerősítés után a lista a mentés állapotára áll vissza. Előtte a mostani
  állapotról is mentés készül („Visszaállítás előtt”), így a visszaállítás is visszacsinálható.

**Külső másolat:** hetente egy másolat a GitHubra is kerül (56 napig őrzi). Ha valaha az egész
adatbázis elveszne, ebből Claude vissza tudja tölteni a „Mentések” közé („Feltöltött”), és
onnan a szokásos módon visszaállítható.

**Mentés letöltése** (⋮ menü, csak széles képernyőn): a teljes lista egy CSV-fájlban, ami
Excelben dupla kattintással jól nyílik – típus, cím, év, állapot, letöltve, dátum, értékelések,
Mama, franchise, műfajok, évadok, hozzáadás dátuma, IMDb / TMDB azonosító.

## 15. Telefonon

A felület telefonra (640 px alatt) külön igazodik:
- **3 kártya egy sorban**, kisebb betűkkel; a „Letöltve” jelvény csak ikon.
- **Szűrők összecsukva:** „Szűrők” gomb, mellette röviden a beállítás (pl. „Filmek · Megnézendő
  · Nem letöltött · Franchise nélkül”); kinyitva minden szűrő és a rendezés. A kereső mindig
  látszik.
- **Lebegő „+”** a jobb alsó sarokban (Cím hozzáadása); lefelé görgetéskor félrehúzódik.
- **Az adatlap alsó lap:** alulról felcsúszik, lefelé húzva bezárul. A Hasonló címek csukva
  indul.
- Az állapotszűrő lenyíló a gombsor helyett.
- **Telefonon nincs:** lista nézet, Tömeges import, Mentés letöltése (ezek 1400 px-től
  érhetők el).

## 16. Billentyűzet, kényelmi apróságok

- **Esc** bezárja az adatlapot, a menüket és a felugró paneleket.
- A **⋮ menüben** és a **franchise-szűrőben** nyilakkal, Home / End-del lehet lépkedni, Enter
  választ.
- A **csillagok** nyilakkal is állíthatók.
- A fejléc felugró listái (harang, ⋮) mindig a képernyőn belül nyílnak.
- **Kevesebb mozgás:** ha a Windowsban / telefonon be van kapcsolva az „animációk csökkentése”,
  az app minden animációt kikapcsol.
- Windows nagy kontrasztú módjában a rendszer saját vezérlői látszanak.

## 17. Honnan jönnek az adatok?

- **TMDB** (The Movie Database) – címek, magyar leírások, borítók, háttérképek, műfajok,
  évadok, megjelenési dátumok, előzetesek, ajánlások, franchise-logók és -gyűjtemények. A lap
  alján a kötelező forrásmegjelölés.
- **OMDb** – az IMDb-értékelések (ha nem elérhető, az app értékelés nélkül is működik).
- **A magyar szinkron** a TMDB-n nem szerepel, ezért a Felfedezés csak közelítés (lásd
  [4.](#4-címek-felvétele)).
- A listád a Supabase adatbázisban van; csak a saját fiókoddal látható.

---

## 18. Változásnapló

Minden fejlesztés után ide kerül egy sor (legújabb felül), és a fenti témák is frissülnek.

| Dátum | Mi változott |
|---|---|
| 2026. 10. 04. | Az adatlapról lekerült a „Megnézve” dátummező; a megnézés napját az app a háttérben jegyzi meg ([6.](#6-állapotok-letöltve-értékelések)). |
| 2026. 10. 04. | A felhasználói leírás elkészült (a 2026. 10. 04-ig kész funkciókkal). |
| 2026. 10. 04. | Még meg nem jelent filmek: szaggatott keret, dátumos jelvény, harang a digitális megjelenésről ([8.](#8-még-meg-nem-jelent-filmek)). |
| 2026. 10. 04. | Franchise-gyűjtemény 2.: minden TMDB-gyűjtemény, a franchise további címei, kézi gyűjtemény ([9.](#9-franchise-ok-és-gyűjtemények)). |
| 2026. 10. 04. | Törlés visszavonása, „Hogy tetszett?”, barátságos üres oldalak, gyorsgombok a letapadt szűrősorban, előzetes, évadok idővonala, Felfedezés. |
| 2026. 10. 04. | Automatikus heti mentés, Mentések ablak, külső másolat ([14.](#14-mentések-és-adatbiztonság)). |
| 2026. 10. 04. | Listanézetben nagyobb borító és cím. |
