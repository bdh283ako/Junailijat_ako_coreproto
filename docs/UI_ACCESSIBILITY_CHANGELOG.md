# UI-saavutettavuusmuutokset — poikkeamat Figmasta (WCAG 2.1 / 2.2 AA)

**Projekti:** Junailijat (perheiden tapahtumat)
**Päivämäärä:** 2026-11-27
**Viitekehys:** WCAG 2.1 / 2.2 AA -taso, EU:n saavutettavuusdirektiivi (EU) 2016/2102 ja laki digitaalisten palvelujen tarjoamisesta 306/2019 (julkisten digitaalisten palvelujen on täytettävä direktiivin mukaiset EN 301 549 -standardin vaatimukset, käytännössä WCAG 2.1 AA).
**Muokatut tiedostot:** `src/app/(frontend)/layout.tsx`, `src/app/(frontend)/styles.css` (projektin globaali tyylitiedosto, "globals.css"), `src/app/(frontend)/gather.css`.
**Ei muutettu:** sovelluksen toiminnallisuutta, API-reittejä, reititystä tai tilanhallintaa — vain fontit, väritokenit ja globaalit tyylit.

Kontrastisuhteet on laskettu WCAG 2.x -määritelmän suhteellisen luminanssin kaavalla (L = 0.2126R + 0.7152G + 0.0722B, kontrasti = (L1+0.05)/(L2+0.05)).

## Muutokset taulukkona

| # | Muutos | Figman alkuperäinen arvo | Uusi arvo | Kontrasti ennen | Kontrasti jälkeen | WCAG 2.1/2.2 -kriteeri | Perustelu (EU) 2016/2102 & 306/2019 |
|---|--------|--------------------------|-----------|-----------------|-------------------|------------------------|--------------------------------------|
| 1 | Korostetekstien fontti | Mynerve | **Ei käytössä ollenkaan.** Tilalla `Momo Trust Display` (otsikot/display, paino 400) ja `Inter` (leipäteksti, UI, tagit, painikkeet, navigaatio) `next/font/google` -kautta | n/a (luettavuus) | n/a | WCAG 1.4.3, 1.4.4 (200 % zoom), 1.4.12 (tekstivälit) | Direktiivin 4 artiklan "havaittavuus": tekstin on oltava luettavaa ja skaalautuvaa. Mynerve on liian koristeellinen korosteteksteihin. Fontit ladataan `latin` + `latin-ext` -alijoukoilla (ä/ö/å) ja `display: 'swap'`. |
| 2 | Leipätekstin riviväli ja skaalautuvuus | kiinteät pikselikoot (px) | `body { font-size: 1rem; line-height: 1.5 }`, otsikot `line-height 1.05–1.2`, `html { font-size: 100% }`, fonttikoot `clamp()`-funktiossa **rem**-yksiköissä | ei taattu | line-height 1.5 | WCAG 1.4.4 (Resize text 200 %), 1.4.12 (Text spacing) | 306/2019: sisällön on pysyttävä käyttökelpoisena, kun teksti suurennetaan 200 %:iin. Rem-yksiköt takaavat skaalautuvuuden selaimen asetuksista. |
| 3 | Terrakotta-pääkorostus tekstin alla | `#C06225` + valkoinen teksti #FFFFFF | `--color-accent: #9E4B16` + `--color-on-accent: #FFFFFF` | **4.19:1** (vain isot otsikot 3:1) | **6.05:1** (AA, lähes AAA) | WCAG 1.4.3 (AA >= 4.5:1 normaaliteksti) | Figman #C06225 + valkoinen = vain 4.19:1, ei kelpaa normaalikokoiselle tekstille. Sävy tummennettiin matemaattisesti #9E4B16:een. Alkuperäinen #C06225 säilyy vain ei-tekstillisenä koristeena (`--color-accent-figma`, 3.72:1 vs tumma teksti, WCAG 1.4.11). |
| 4 | Salvia / painike- ja pillitausta | `#9CB9B7` + valkoinen teksti | `--color-accent-soft: #9CB9B7` **vain** tumman `--color-on-accent-soft: #2E211B` tekstin kanssa; valkoinen teksti salvan päällä kielletty | **2.09:1** (hylätty) | **7.44:1** (AAA) | WCAG 1.4.3 (AA >= 4.5:1, AAA >= 7:1) | Valkoinen teksti salvan päällä olisi vain 2.09:1 — direktiivin vastainen. Siksi salvia toimii vain taustana tummalle kahvinruskealle tekstille. |
| 5 | Päätausta ja korttipinnat | (Figman maanläheinen paletti) | `--color-bg: #F7F6F3`, `--color-surface: #FFFFFF`, `--color-surface-alt: #F0EEE9` | n/a | pinnat eroteltu reunaviivalla, ks. #6 | WCAG 1.4.11 (Non-text contrast >= 3:1) | Selkeä pintaerottelu ilman pelkkää varjoa tukee direktiivin havaittavuusvaatimusta; kortit käyttävät aina `--color-border`-reunaviivaa. |
| 6 | Reunaviivan väri | haaleat rajat #D8D4CC (1.37:1), #C9C4B8 (1.61:1), #9BAC9F (2.21:1) | `--color-border: #7E7A70` | 1.37–2.21:1 (alle 3:1) | **3.96:1 vs bg, 4.28:1 vs surface** | WCAG 1.4.11 (>= 3:1) | Korttien ja syötekenttien rajat erottuvat nyt myös ilman varjoa (ei pelkkä drop shadow), kuten direktiivin AA-tarkastus vaatii. |
| 7 | Päätekstin väri | (tumma, ei tarkasti määritelty) | `--color-ink: #2E211B` (Figman kahvinruskea) | vanha #17251F/#F6F7F1 = 14.76:1 | **14.40:1 vs bg, 15.56:1 vs surface** (AAA) | WCAG 1.4.3 (AAA >= 7:1) | Tumma pääteksti takaa AAA-tason kontrastin kaikilla pinnoilla direktiivin mukaisesti. |
| 8 | Metatekstin väri | haalea harmaa: placeholder #8B918D, korosteteksti #6D8C76 | `--color-ink-muted: #574941` (myös placeholder, `.brand span`, `.integration-note-index`) | #8B918D: **3.21:1**, #6D8C76: **3.43:1** (alle 4.5:1) | **7.98:1 vs bg, 8.63:1 vs surface** (AAA) | WCAG 1.4.3 (AA >= 4.5:1) | Myös metatekstin (päivämäärät, kuvaukset, placeholderit) on oltava AA-kelpoinen — direktiivi koskee kaikkea tekstiä. Pieni korosteteksti `--color-eyebrow: #557263` = 4.89:1 (AA) hyväksytty. |
| 9 | Fokusilmaisin (näppäimistökäyttö) | `outline: 3px solid rgba(32,63,52,0.25)` (~1.6:1, ei havaittava) | Globaali `:focus-visible`: `outline: 3px solid #9E4B16 + offset 2px` kaikille `a, button, input, select, textarea, iframe, summary, [tabindex], [role=button]` | ~**1.58:1** (hylätty) | **5.60:1 vs bg, 6.05:1 vs surface** (>= 3:1) | WCAG 2.4.7 (Focus Visible, AA) + 1.4.11 (indikaattori >= 3:1) | Näppäimistön fokusindikaattori on pakollinen direktiivin 2.4.7 mukaisesti ja sen on erotuttava >= 3:1 (WCAG 2.2 lisäys 1.4.11). 3px paksu #9E4B16-kehys + 2px offset täyttää vaatimuksen (vähintään 2px). |
| 10 | Kosketusalueiden minimikoko | ikonipainike 42px, kielivalinta 32px | `--touch-target-min: 44px` sovellettu `.button`, `.icon-button`, `.language button`, mobiilivalikon `.nav a`, `.feed-search input`, `.refresh-button`, `.skip-link` | 32–42px | **44px** | WCAG 2.5.5 (AAA 44px), WCAG 2.2 2.5.8 (AA >= 24px) | 306/2019 + direktiivi: kosketuskohteiden on oltava riittävän suuria myös motorisesti rajoitteisille käyttäjille. |
| 11 | Layout: tablet- ja mobiilimitoitus | leveä desktop-säiliö `min(100% - 48px, 1320px)` | keskitetty säiliö `min(100% - 2rem, 48rem)` (max-w-3xl) kaikilla näytöillä; ei erillistä desktop-näkymää | n/a | n/a | WCAG 1.4.10 (Reflow: 320 CSS px leveys ilman kahden suunnan vieritystä) | Kapea keskitetty säiliö varmistaa toimivuuden 320 px:n mobiilileveydellä ja 200 % zoomilla ilman vaakasuuntaista vieritystä. |

## Tokenien lopulliset arvot (styles.css `:root`)

```css
--color-bg: #f7f6f3;            /* päätausta */
--color-surface: #ffffff;       /* korttipinta (aina --color-border:in kanssa) */
--color-surface-alt: #f0eee9;   /* toissijainen pinta */
--color-border: #7e7a70;        /* 3.96:1 vs bg, 4.28:1 vs surface (WCAG 1.4.11) */
--color-ink: #2e211b;           /* 14.40:1 vs bg (AAA) */
--color-ink-muted: #574941;     /* 7.98:1 vs bg (AAA) */
--color-eyebrow: #557263;       /* 4.89:1 vs bg (AA) */
--color-accent: #9e4b16;        /* 6.05:1 vs #fff (AA) — Figman #C06225 oli 4.19:1 */
--color-on-accent: #ffffff;
--color-accent-figma: #c06225;  /* vain ei-tekstillinen koriste */
--color-accent-soft: #9cb9b7;   /* vain tumman #2e211b -tekstin kanssa (7.44:1) */
--color-on-accent-soft: #2e211b;
--touch-target-min: 44px;       /* WCAG 2.5.5 / 2.5.8 */
--focus-ring-color: #9e4b16;    /* 5.60:1 vs bg (WCAG 2.4.7 + 1.4.11) */
--focus-ring-width: 3px;
--focus-ring-offset: 2px;
```

Fonttimuuttujat `next/font/google` -latauksesta (`layout.tsx`): `--font-sans` (Inter, leipäteksti/UI) ja `--font-display` (Momo Trust Display, otsikot), subsetit `latin` + `latin-ext`.

## Vanhojen tokenien yhteensopivuus

`gather.css`:n vanhat nimet (`--ink`, `--paper`, `--muted`, `--line`, `--soft`, `--forest`, `--lime`) on aliasoitu uusiin `--color-*`-tokeneihin, jotta yksikään komponentti ei rikkoudu eikä toiminnallisuus muutu.

## Huomio UI/UX-suunnittelijoille

- Älä käytä valkoista tekstiä suoraan `#9CB9B7`- tai `#C06225`-taustan päällä — käytä `#2E211B` (salvia) tai tummennettua `#9E4B16` + valkoinen (terrakotta).
- Kaikki interaktiiviset elementit saavat automaattisesti 3px `#9E4B16` -fokuskehyksen — älä poista `:focus-visible`-sääntöä komponenteista.
- Kosketuskohteiden minimikoko on 44px (`--touch-target-min`) — älä pienennä painikkeita/pillareita tämän alle.
- Tekstikoot ovat rem-yksiköissä ja leipätekstin line-height 1.5 — säilytä nämä myös uusissa komponenteissa (WCAG 1.4.4 / 1.4.12).

## 2026-11-27 — Keskitetty teema-arkkitehtuuri (ei massamuokkauksia komponentteihin)

**Ratkaisu:** sen sijaan, että etusivun (`/`) shellproto-näkymän satoja yksittäisiä Tailwind-luokkia korvattaisiin käsin, globaali tyylitiedosto (`src/app/(frontend)/styles.css`) ohjaa koko ilmettä keskitetysti:

1. **`@theme`-väritokenit** (`--color-bg #F7F6F3`, `--color-surface #F0EEE9`, `--color-border #7E7A70`, `--color-ink #2E211B`, `--color-ink-muted #574941`, `--color-accent #9E4B16`, `--color-accent-soft #9CB9B7`) emittoituvat `:rootiin` JA luovat automaattisesti Tailwind-utilityt (`bg-bg`, `text-ink`, `border-border`, …). Tokenin vaihto päivittää koko sovelluksen kerralla.
2. **`@theme inline` -fonttiteemat:** `--font-sans: var(--font-inter), Inter, …` ja `--font-display: var(--font-momo), 'Momo Trust Display', …` — arvot tulevat `next/font/google`-luokista `layout.tsx`:ssä (`--font-inter`, `--font-momo`; subsetit latin + latin-ext). Mynerveä ei käytetä missään.
3. **Semanttiset pintaluokat `@layer components`:** `.ui-shell` (keskitetty max-w-3xl -säiliö, ei desktop-leveyttä), `.ui-card` (pinta + 1px `--color-border` + rounded-3xl + varjo), `.ui-card-accent` (#9E4B16 + valkoinen teksti, 6.05:1 AA), `.ui-pill-soft` (#9CB9B7 + tumma #2E211B teksti, 7.44:1 AAA, min 44×44px). Uudet komponentit käyttävät näitä pitkien luokkajonojen sijaan.
4. **Slate-luokkien keskitetty väriohjaus `@layer utilities`:** yleisimmät kovakoodatut luokat (`bg-white`, `bg-slate-50/100/200/400/800/900/950`, `border-slate-100/200/300/800/900`, `ring-slate-200/900`, `text-slate-400…900`, läpikuultavat overlay-`bg-slate-900/50` ym.) ohjautuvat automaattisesti tokeneihin, joten etusivun shellproto-näkymä seuraa teemaa ilman komponenttimuutoksia. Kontrastit säilyvät: tummat palkit `--color-ink` + `text-white` = 15.56:1 (AAA); tekstit pinnoilla `--color-ink`/`--color-ink-muted` = 14.40:1 / 7.98:1 (AAA); reunat `--color-border` ≥ 3.69:1 (WCAG 1.4.11).
5. **Vuorovaikutus:** globaali `:focus-visible` = 3px solid `#9E4B16` + 2px offset kaikilla interaktiivisilla elementeillä (WCAG 2.4.7 AA, 1.4.11 ≥ 3:1); `--touch-target-min: 44px` (WCAG 2.5.5/2.5.8) käytössä painikkeissa, pillereissä, valikoissa ja skip-linkissä.

**Vaikutus ylläpidettävyyteen ja WCAG AA -yhdenmukaisuuteen:** väri-, fontti-, pyöristys- ja kosketusaluepäätökset tehdään nyt yhdessä paikassa (tokenit), joten yksittäinen muutos ei voi lipsua AA-rajojen alle eri komponenteissa. Direktiivin (EU) 2016/2102 / lain 306/2019 mukainen yhdenmukainen kontrasti (WCAG 1.4.3/1.4.11) toteutuu keskitetysti, ja uudet näkymät perivät saavutettavuuden automaattisesti käyttämällä semanttisia luokkia (`ui-shell`, `ui-card`, `ui-card-accent`, `ui-pill-soft`). Toiminnallisuutta, API-reittejä, reititystä, tilanhallintaa tai komponenttien proppeja ei muutettu.

**Tunnetut kosmeettiset varoitukset:** `next build` / `next dev` (Turbopack) tulostaa kerran: `Warning: Failed to find font override values for font 'Momo Trust Display'. Skipping generating a fallback font.` Tämä johtuu siitä, että fontti puuttuu Next.js:n valmiiksi lasketusta fallback-metriikkataulukosta; SWC:n fonttitransformi tulostaa varoituksen tästä huolimatta, vaikka `adjustFontFallback: false` on asetettu (layout.tsx). Varoitus on **pelkästään kosmeettinen**: fontti latautuu ja renderöityy normaalisti (todettu palvellusta CSS:stä), vain automaattinen fallback-fontin kokosäätö jätetään pois — `display: 'swap'` näyttää väliaikaisesti järjestelmäfonttia. API-reitit (esim. `GET /api/families 200`) eivät vaikuta.

## 2026-11-27 — Tapahtumakortit ja alapalkki: terrakotta/salvia-sävytys (Jutan mallikuvasta), WCAG AA

**Tapahtumakortit (`EventsTabPanel.tsx`, vain className/JSX-pinta — ei proppeja, ei logiikkaa):**
- Korttipinta `--color-surface` (#F0EEE9) + `1px solid var(--color-border)` + `rounded-3xl` (WCAG 1.4.11: reunaviiva 3.69–3.96:1).
- Vasemman reunan **päivämääräblokki** (salvia `--color-accent-soft` + tumma `--color-ink` teksti = 7.44:1 AAA): kuukausi lyhenteenä ylhäällä, päivänumero alla; muodostetaan vain visuaalisesti aikatekstistä (`pe 27.11. klo 17.00`), alkuperäinen aikateksti säilyy aina myös tekstinä.
- Päätoiminto "+ Menossa": terrakotta `--color-accent` #9E4B16 + valkoinen teksti = **6.05:1 (WCAG 1.4.3 AA)**; "✓ Menossa" -tila salvialla + tummalla tekstillä (7.44:1 AAA). Toissijaiset pillit (Menossa-chat, Kalenteriin, Kartalla, Lisätiedot): pinta/border-tokeneilla, tumma teksti, **min-h-11 = 44px kosketusalue** (WCAG 2.5.5/2.5.8).
- Ikäryhmä-/hinta-/aluepillit: salvia/hiekka-tokeneilla, `--color-ink`/`--color-ink-muted` -tekstit (≥ 7.4:1), WCAG 1.4.3.
- Kaikki toiminnot (Päivitä, suodattimet, haku, osallistuminen, chat, kalenteri, kartta, linkki) ennallaan — myös 44px kosketusalueet lisätty.

**Alapalkki (`shellproto/page.tsx` nav):** lämmin hiekan pinta `--color-surface` + `border-t var(--color-border)`; aktiivinen välilehti salvialla `--color-accent-soft` -pillillä + tumma `--color-ink` teksti (7.44:1 AAA); inaktiiviset `--color-ink-muted` (7.45–7.98:1). Välilehtien onClick-/aktiivisuus-/reitityslogiikka koskematon; `min-h-11` (44px) ja globaali 3px `#9E4B16` `:focus-visible` -kehys (WCAG 2.4.7/2.5.5/2.5.8).

**Miksi suuria terrakotta-valinta-alueita (2x2 "Löydä perheitä / Tapahtumat / Palvelut / Vertaistuki") ei vielä toteutettu:** isot täysväriset #9E4B16 -pinnat toimivat tekstillä (6.05:1), mutta suuret väripinnat korostuvat liikaa Jutan mallikuvasta ja vaatisivat erillisen layout-muutoksen; tehdään vaiheittain pienemmillä korostuksilla (napit, pillit, aktiivinen välilehti) ensin.

## 2026-11-27 — Shellproton mobiili- ja tablettiasettelu

- Shellin leveys mukautuu jatkuvasti näkymään 16/24 px sivumarginaaleilla ja pysyy keskitettynä enintään 48 rem leveänä; näkymän sisältö saa kutistua ilman vaakasuuntaista ylivuotoa.
- Tapahtuma-, perhe-, yhteisö-, profiili- ja jäsenkorttinäkymien monisarakkeet alkavat vasta 768 px:n kohdalla, jotta kapea mobiili/tabletti säilyy yksipalstaisena. Pienet kosketuskohteet ovat vähintään 44 px korkeita 767 px:iin asti.
- Alapalkin kohteet ja muokkauslomakkeiden rivit saavat rivittyä kapeassa leveydessä. Väritokenit, 3 px:n `:focus-visible`-kehys, toiminnallisuus, reititys, tilanhallinta ja propit säilyvät ennallaan.

## 2026-11-27 — Mobiilirajauksen viimeistely (375–639 px)

- Ulompi shell keskitetään enintään 430 px leveäksi, ja sivuille jää 14 px marginaali; tablettileveydellä säiliö laajenee hallitusti `sm:max-w-2xl` / `md:max-w-3xl` -rajoihin. Juuritasolla estetään vaakasuuntainen ylivuoto.
- Yläpalkki ja tapahtumakorttien otsake/sisärivit sallivat rivittymisen ja kutistumisen. Alapalkki rajautuu shellin leveyteen, ja välilehtitekstit katkaistaan hallitusti; painikkeiden 44 px minimikorkeus ja fokuskehykset säilyvät.
- Kelluvat debug- ja chat-paneelit rajataan näkyvälle alueelle myös silloin, kun selainikkunaa kavennetaan niiden avaamisen jälkeen.

## 2026-11-27 — Yhteisöterminologia ja etusivun pikavalinnat

- Alapalkin ja kirjautumista vaativan välilehden teksti käyttää nyt nimeä ”Yhteisö”; sama olemassa oleva välilehti- ja kirjautumisportti säilyy.
- Etusivun tapahtumanäkymän yläosaan lisättiin yksi responsiivinen kolmen valinnan rivi (Perheet, Tapahtumat, Yhteisö). Kortit käyttävät saavutettavia pintatokeneita, vähintään 76 px:n korkeutta ja globaalia fokuskehystä; Palvelut-osiota ei lisätty.
- Perhe- ja tapahtumanäkymien otsikot ovat ”Perheitä lähelläsi” ja ”Tulevat tapahtumat”.
- Perhenäkymän otsikko näytetään myös mobiilileveydellä.

## 2026-11-27 — Etusivun perhekaruselli

- Etusivulle lisättiin lähialueen perheiden vaakasuuntainen, snap-kiinnityksellä toimiva karuselli käyttäen jo suodatettua perhelistaa ja olemassa olevaa tykkäys-/ohitustoimintoa.
- Korttien leveys jättää seuraavan kortin reunan näkyviin mobiilissa ja tabletilla; vaakasuuntainen vieritys pysyy karusellin sisällä. Toimintopainikkeet ovat vähintään 44 px korkeita ja käyttävät väritokeneita sekä globaalia fokuskehystä.

## 2026-11-27 — Suodatinkontekstin Map Peek -karttanauhat

- Tapahtuma- ja perhenäkymiin lisättiin kompakti Map Peek suodattimien yhteyteen. Kartta saa tapahtumien nykyisen ikä-/haku-/kaupunkisuodatuksen tai perhenäkymän nykyisen suodatetun joukon; muita kohdelistoja ei syötetä.
- Esikatselukartta ei kaappaa osoitinta tai näppäimistöfokusta, säilyttää karttatiilien attribuution ja rajautuu mobiili-/tablettikehyksen sisään.

## 2026-11-27 — Laajennettu karttapeittokerros ja elekäyttö

- Map Peek avaa koko näkymän peittokerroksen sekä yksipisteisestä ”Laajenna kartta” -painikkeesta että selkeästä kahden sormen loitonnuseleestä; yhden sormen sivu-/pystyvieritys säilyy.
- Peittokerroksessa on Tapahtumat-, Perheet- ja Kaikki-kerrosvalinnat, Sulje kartta -painike sekä Escape-sulku. Sulku palauttaa aiemman fokus-kohdan ja alkuperäisen näkymän/rullauskohdan.

## 2026-11-28 — Perhemätsien, karttamerkkien ja näkymien sävyjen yhtenäistäminen

- Kiinnostunut-tilat käyttävät salviaa tummalla tekstillä ja metsänvihreällä reunuksella; toteutuneet mätsit erottuvat metsänvihreällä myös Yhteisö- ja karttanäkymissä.
- Kartan koti-, tapahtuma-, alue-, perhe- ja MLL-kahvilamerkit käyttävät terrakotta-, salvia-, metsänvihreä- ja murrettua lilaa sävyä; selite ja kartan kontrollit vastaavat merkkejä.
- Yhteisö- ja profiilinäkymien valinnat, toimintopainikkeet sekä staattiset kortit on sovitettu shellproton väritokeneihin ja oletuspyöristyksiin. Interaktiiviset kosketuskohteet säilyttävät vähintään 44 px korkeuden ja globaalin fokuskehyksen.

## 2026-11-28 — Meripihka- ja karmiinitokenit

- Lisättiin `--color-amber: #BE5518` (4,67:1 valkoisella) terrakotan rinnalle etusivun 1×3-toimintokorttien lämpimään sävyvaihteluun. Esimerkkisävy `#C2591A` ei yllä valkoisella AA-kontrastiin (4,43:1), joten token tummennettiin.
- Lisättiin `--color-carmine: #A63A50` (6,28:1 valkoisella) keskustelu- ja aktiivisuusmerkeille; Yhteisö-välilehden ja keskustelulistojen lukemattomien viestien merkeissä on lisäksi valkoinen reunus.
- Korttien teksti pysyy valkoisena vain riittävän tummilla korostuspinnoilla; salviaa käytetään edelleen vain tumman tekstin kanssa.

## 2026-11-28 — Tapahtumakortin ikoni- ja päivämääräviimeistely

- Tapahtumakortin osallistumis-, chat-, kalenteri- ja karttatoiminnot käyttävät samankokoisia `lucide-react`-viivapiirrosikoneja. Näkyvät painiketekstit korvattiin ikoneilla; `aria-label`- ja `title`-nimet sekä vähintään 44 × 44 px:n kosketusalueet säilyvät.
- Caveat 600 (`latin`) on rajattu vain päivämäärälaatikon päivänumeroon. Kuukausilyhenne on normaalipainoinen ja eroteltu numerosta.

## 2026-11-28 — Tapahtumakortin tägi- ja maksuton-merkki

- ”Lapset ja perheet” -tägi käyttää kevyttä neutraalia pohjaa ja tummaa tekstiä salvian sijaan; muut tapahtumaikäryhmät säilyttävät nykyisen tyylinsä.
- Maksuton-merkki erottuu kompaktilla `Tag`-viivapiirrosikonilla ja metsänvihreällä tekstillä/reunalla, ilman kortin korkeuden kasvattamista tai toiminnallisuusmuutoksia.

## 2026-11-28 — Kartan tapahtuma- ja perhefeed

- Karttanäkymän alle lisättiin kapealla näytöllä pinoutuva ja `md:`-leveydellä kaksipalstainen perheosumien ja oikean tapahtumasyötteen näkymä. Tapahtumakortti avautuu saavutettavalla `aria-expanded`-painikkeella, ja ikonitoiminnot säilyttävät osallistumis-, chat-, kalenteri-, kartta- ja lisätietopolut.
- Kartan tapahtuma- ja perhemarkkerien valinta avaa ja korostaa vastaavan feedikortin; kortin valinta kohdistaa kartan. Toiminnot käyttävät olemassa olevia osallistumis-, ilmoittautumis-, chat- ja valintalokituksen käsittelijöitä.

## 2026-11-28 — Lähellä.fi-tapahtumasyötteen lapsiperheraajaus

- `/api/events` yhdistää Lähellä.fi- ja Linked Events -syötteet säilyttäen olemassa olevat kartta-, osallistumis-, chat-, kalenteri- ja sijaintitoiminnot.
- Lähellä.fi haetaan useammilta sivuilta hallitulla sivurajalla ja aikakatkaisulla. Kohteet rajataan pääkaupunkiseudulle kaupunkitiedon, koordinaattien ja `pksAreas`-fallbackin perusteella.
- Ei-lapsiperhetoiminta suodatetaan pois ja hyväksytyt kohteet mäpitetään yhteisiin kanonisiin tägeihin; HTML ja HTML-entiteetit siivotaan näkyvästä tekstistä.
- Feedin kortit sallivat sisällön kutistumisen ja rivittymisen; ikonipainikkeet säilyttävät vähintään 44 × 44 px kosketusalueen, tekstien kontrastitokenit ja globaalin 3 px `:focus-visible`-kehyksen.

## 2026-11-28 — Shellproton vihreiden ja siniturkoosien sävyjen yhtenäistäminen

- Ylätunnisteen ”Piiri”-sana ja ”Profiili valmis” -tunniste käyttävät nyt metsänvihreää ja hillittyä palettipintaa; tapahtumasyötteen aktiivisuusmerkki käyttää metsänvihreää pistettä, salvian taustaa ja tummaa tekstiä.
- Shellproton vanhat emerald-, green-, cyan-, sky-, blue- ja teal-luokat poistettiin myös jäsen-, kartta-, tapahtuma- ja kehitysnäkymistä. Vaalealla salvialla käytetään tummaa tekstiä; täysillä metsänvihreillä pinnoilla valkoinen teksti säilyttää AA-kontrastin.

## 2026-11-28 — Ylätunnisteen, lähdeinfopillien ja tapahtumatoimintojen viimeistely

- `PerhePiiri` käyttää Caveat-fonttia tummalla tekstillä ja metsänvihreällä korostuksella. Tapahtumalähteiden ja oletusrajauksen infopillit käyttävät nyt rauhallista meripihkapintaa, tummaa tekstiä ja meripihkaista tilapistettä salvian sijaan.
- Tapahtumakorttien lisätietolinkit ovat yhdenmukaisia 44 × 44 px:n ikonikohteita, joilla on ruudunlukijalle `aria-label`, hover-vihje ja globaali 3 px:n fokuskehys.

## 2026-11-28 — Alapalkin navigaation yksirivisyys

- Alapalkin navigaatio ja välilehtitekstit pysyvät yhdellä vaakarivillä ilman vaakasuuntaista ylivuotoa; kohteiden mitoitus säilyttää yhtenäisen korkeuden ja vähintään 44 × 44 px:n kosketusalueet.
- Aktiivinen välilehti ilmaistaan `aria-current="page"`-attribuutilla; WCAG AA -kontrasti, rauhallinen animaatioton ilme ja 3 px:n `:focus-visible`-kehys säilyvät.

## 2026-11-28 — Alapalkin aktiivisen välilehden hillitty korostus

- Aktiivinen navigaatioikoni erottuu terrakotan värillä ja `strokeWidth={2.5}`-arvolla; muut ikonit pysyvät hillittyinä samalla Lucide-viivapiirrostyylillä. Salviatäyttö poistettiin aktiiviselta välilehdeltä.
- Välilehtitekstit pysyvät yksirivisinä, painikkeiden vähintään 44 px:n korkeus, `aria-current="page"` ja globaali 3 px:n fokuskehys säilyvät; uusia animaatiokirjastoja ei lisätty.

## 2026-11-28 — Mynerve-korostefontin rajattu käyttöönotto

- Mynerve korvasi Caveatin päivämäärälaatikon päivänumerossa ja `PerhePiiri`-brändiotsikossa. Fontti on rajattu näihin elementteihin; kuukausitekstin lihavoimaton tyyli, väljyys ja päivämäärälaatikon korkeus säilyvät.
- Leipätekstit, painikkeet, lomakkeet ja navigaatio käyttävät edelleen Interiä; WCAG AA -kontrastit, kosketusalueet ja fokuskehykset eivät muuttuneet.

## 2026-11-28 — Etusivun 1×3-toimintokorttien ikonit ja ingressit

- Perheet-, Tapahtumat- ja Yhteisö-korteissa on yhtenäiset `lucide-react`-viivapiirrosikonit (`strokeWidth={2}`) emojeiden sijaan sekä lyhyet, valkoisella tekstillä kuvatut ingressit terrakotta-/meripihkapinnoilla.
- Korttien navigointi- ja tilalogiikka säilyi; kosketusalueet, `min-w-0`-mitoitus ja globaali 3 px:n `:focus-visible`-kehys säilyvät.

## 2026-11-28 — PKS-alueiden keskitetty valintadata

- Profiilin kotiseutu, kaupunki-/karttasuodattimet ja ilmoittautumisen kaupunkivalinta käyttävät nyt `pksAreas`-moduulin kaupunki-, alue- ja koordinaattitietoja. Vanhojen tallennettujen aluearvojen näyttö ja profiilisynkronointi säilyvät.
- Sijaintivalinnat käyttävät saavutettavia väritokeneita, säilyttävät mobiilissa kutistuvan mitoituksen, vähintään 44 px:n korkeuden ja globaalin 3 px:n `:focus-visible`-kehyksen.

## 2026-11-28 — Yhtenäinen kotisijainti ja mätsin jälkeinen sijaintisuostumus

- Yläpalkin sijaintipilleri avaa saavutettavan valitsimen, joka käyttää `pksAreas`-alueita ja selainpaikannusta. Aluevalinta ja tarkka geolokaatiokoordinaatti tallentuvat samaan perheprofiilitilaan ja ohjaavat kotimarkkeria sekä `km kotoa` -laskentaa.
- Muille perheille näytetään ennen mätsiä vain karkea alue ja etäisyys. Tarkka kotisijainti voidaan jakaa vasta mätsin jälkeen erillisellä, oletuksena poissa olevalla suostumuskytkimellä `Data & Tietosuoja` -asetuksissa.
- Paikannustilan viestit käsittelevät luvan eväämisen, paikannuksen puuttumisen ja tallennuksen; valitsin säilyttää mobiili-/tablettimitoituksen, 44 px:n kosketusalueet ja globaalin 3 px:n fokuskehyksen.

## 2026-11-28 — Paikannustoiminto asetussivulle

- `ProfileSettingsPanel`-asetussivulle lisättiin selkeä oman tarkan sijainnin paikannuspainike. Se käyttää samaa `navigator.geolocation`-kydentää ja tallentaa koordinaatit sekä lähimmän `pksAreas`-alueen perheprofiilitilaan.
- Haetaan-, tallennettu-, lupa evätty- ja ei saatavilla -tilat näytetään ruudunlukijalle ja visuaalisesti saavutettavasti. Tarkkoja koordinaatteja ei näytetä muille perheille ilman mätsin jälkeistä erillistä lupaa.
- Yläpalkin sijaintipillin rinnalle lisätty valitsin säilyttää kompaktin otsakeasetuksen ilman erillistä pystytason harhaa. Kartan olemassa oleva aluevalinnan zoomauskäyttäytyminen säilyi muuttumattomana.

## 2026-11-28 — Karttafeedin tapahtuma-/perhevalinnan zoomaus

- Karttasivun feed käyttää tableteissa ja leveämmissä näkymissä kaksi palstaa (`Perheet` vasemmalla, aito tapahtumafeedi oikealla) ja mobiilissa pinoavaa yksipalstaisuutta. Tapahtumakortit ovat tiiviitä rivejä, avautuvat `aria-expanded`-tilalla ja säilyttävät yksiriviset Lucide-ikonitoiminnot.
- Tapahtuman listasta, markkeristä tai kartalle-painikkeesta valinta keskittyy tapahtuman paikkaan ja zoomaa tasolle 14. Perheen valinta korostaa vastaavan markkerin ja kortin, mutta ei zoomaa karttaa eikä avaa perheelle erillistä kohdennus- tai zoomaukseen perustuvaa karttapeitettä.

## 2026-11-28 — Debug-paneelien URL-rajattu näkyvyys ja kerrosjärjestys

- Demo-Log- ja DB-Feed-paneelit näkyvät vain, kun URL-parametri on `debug=1` tai `debug=true`; muissa tapauksissa paneelit ja niiden valintanapit pysyvät piilossa.
- Debug-paneelit käyttävät `z-[2000]`-kerrosta, joten ne pysyvät kartan, kelluvien paneelien, näkymäpeitteiden ja modaalien päällimmäisenä kerroksena.
- Paneelien sulkeminen, päivittäminen ja debug-napit säilyttävät vähintään 44 × 44 px:n kosketusalueen, saavuttavat värit ja globaalin 3 px:n fokuskehyksen.

## 2026-11-28 — Shellkuoren tabletileveys

- Mobiilissa kuori säilyttää täysleveän `w-full`-/`min-w-0`-mitoituksen käytettävissä olevaan ruutuleveyteen.
- Tabletissa ja leveämmissä näkymissä kuoren ja alapalkin maksimileveys laajenee hallitusti `md:max-w-4xl`-luokkaan (896 px), jolloin noin 834 px:n tabletissa kuori ei veny liian leveäksi eikä riko kaksipalstaisen feedin asettelua.

## 2026-11-28 — Lähteiden mitatut aikakatkaisut

- Lähellä.fi-, Linked Events- ja EventPulse-haut erotetaan omiin rinnakkais-haaroihinsa. Hidas EventPulse ei jarruta Le- tai Lähellä-tuloksia, ja 60 sekunnin palvelinvälimuisti palauttaa valmiit tulokset viiveettä.
- Aikakatkaisut johdettiin erikseen `curl`-mitatusta vasteajasta kertomalla 1,5:llä: Lähellä.fi 2413 ms, Linked Events 3860 ms, EventPulse 13011 ms ja Kauniainen 207 ms.
- `?debug=1` ja `?debug=true` näyttävät lähde- ja aikakatkaisutilat säilyttäen 44 px kosketusalueet ja 3 px fokuskehyksen.

## 2026-11-28 — Alustan selainvälilehden tunniste

- Selainvälilehden nimi näyttää alustan: `[localhost]` paikallisessa kehityksessä ja `[vercel]` muissa ympäristöissä. Sivun ulkoasu tai muu käyttöliittymä ei muutu.

## 2026-11-28 — Lähellä.fi-diagnostiikka eventdebug-näkymässä

- Eventdebug-näkymä näyttää Lähellä.fi-suppilon laskurit (raakarivit, PKS-rivit, lapsiperhe-/viikkorivit, lopulliset osumat ja haetut sivut), vasteajan, HTTP-tilan, lähdekohtaiset timeoutit ja välimuistin tilan.
- Lähellä.fi-kohteet avautuvat normalisoituina kortteina ja raakakohteina; raakakatselussa näkyvät `demographic`, `theme`, `format`, `pricing`, `group`, osoite, koordinaatit sekä sijaintitarkkuuden/fallbackin tila.
- Haku ja lisätietojen avaus käyttävät olemassa olevia saavutettavuus-, kontrasti-, kosketusalue- ja fokuskehyssääntöjä.

## 2026-11-28 — Eventdebugin kelluva lähde- ja lokisuodatus

- Eventdebugin yhteenvetorivit korostavat Lähellä.fi:n PKS-osumia; HTTP- ja viivetiedot erotetaan per lähde (Lähellä.fi, Linked Events, EventPulse ja Kauniainen).
- Debug-console on kelluva `z-[2000]`-paneeli, jota voi suodattaa hakusanalla, lokitasolla (OK, INFO, WARN, ERR) ja lähteellä. Paneeli säilyttää 44 px kosketusalueet ja 3 px fokuskehyksen.

## 2026-11-28 — Karttamarkkerien ja -filtterien lähdevisuaalisuus

- Karttasivulle lisättiin kanoniset ikä- ja sisältöpillerisuodattimet sekä Kohtaamispaikat-kytkin. Kohtaamispaikat ovat oletuksena piilossa, ja ne voi ottaa mukaan tai valita ainoaksi markkeriluokaksi.
- Tapahtuma-, koti-, perhematsi- ja kohtaamispaikkamerkit toteutettiin SVG-pisaroilla. Normaalitilassa perhematsit käyttävät salviaa/syvää vihreää, tapahtumat terrakottaa/karmiinia, kohtaamispaikat meripihkaa ja koti syvää sinistä.
- `?debug=1` ja `?debug=true` värittävät tapahtuma- ja paikkamarkkerit lähteittäin: Linked Events terrakotta, Lähellä.fi meripihka ja EventPulse syvä luumu. Lähdevärit esitetään myös debug-paneelissa.

## 2026-11-28 — Kartan pisaramarkkerien koko ja ryhmälukumäärä

- Tapahtuma-, kohtaamispaikka- ja perhemätsipisarat pienennettiin noin 26 × 34 px:iin, kotimerkki 28 × 36 px:iin. Leafletin ikonin ulkokehys säilyy 44 × 44 px:n napautusalueena.
- Samassa koordinaatissa ryhmitellyt tapahtumat näyttävät määrän valkoisena tekstinä suoraan pisarassa; ruudunlukijan nimi ja Leafletin tooltip kertovat ryhmän tapahtumamäärän. Normaalinäkymän ja debug-tilan värit säilyvät.

## 2026-11-28 — Kartan perheosumien sijainti ja suodattimet

- Perheosumien koordinaatit ratkaistaan tallennetusta `pksAreas`-alueesta; `bdh283` kohdistuu Leppävaaraan eikä käyttäjän kotisijaintiin.
- Poistettiin mallintamaton `Perhekahvila & vertaistuki` -tägi sekä kartan turhat alue-/karttarajausmerkinnät. Kohtaamispaikoille on yksi oletuksena pois oleva Lucide-ikonillinen `aria-pressed`-kytkin (44 px).
- Kaupunkivalikoissa ja näkyvissä lähde-/debug-teksteissä käytetään nimeä ”Pääkaupunkiseutu”; karttaselite käyttää kodin, tapahtumien, perheosumien ja kohtaamispaikkojen ikoneja.

## 2026-11-28 — Shellproton versiointiperiaate

- Shellproton kartan perheosumat esitetään vaakasuuntaisena, näppäimistöllä selattavana karusellina. Tapahtumalista sai haun ja kevyemmän sivutuksen; yläpalkin kohtaamispaikkakytkin eriytettiin tägisuodattimista.
- Etusivun tapahtumakorttien otsikot käyttävät nyt karttakorttien kevyempää tyyliä. Shellproton versiotunnus annetaan vain tuotantopushista; saman päivän PATCH-numero järjestää tuotantopushit.

## 2026-11-28 — Tapahtumien ikä- ja teemalajittelu

- Tapahtumalähteiden ikävaiheet ja teemat normalisoidaan yhteisiin tunnisteisiin; `eventdebug` näyttää niiden osumat sekä maksullisten, maksuttomien ja tuntemattoman hintatiedon määrät.
- Kartan ikä- ja teemasuodattimet käyttävät samoja tunnisteita. Kohtaamispaikat ovat erillinen 44 px:n `role="switch"`-tasokytkin, jolla on näkyvä tila ja meripihkainen taloikoni.

## 2026-11-28 — Maksullisten tapahtumien karttasuodatin

- Kartan hintasuodatin vaihtui `Maksuton`-valinnasta `Maksullinen`-valinnaksi, jotta käyttäjä voi rajata näkymään maksulliset tapahtumat.

## 2026-11-28 — Perhekorttien aksentit ja kartan tasonkytkimet

- Perhekorteissa korostetaan aluetta, lasten ikäryhmää ja kiinnostuksia hillityillä salvia-/terrakotta-aksenteilla sekä selkeillä verkostoitumis-, kartta- ja keskustelutoiminnoilla.
- Tapahtumakorttien pohjat ja ikä-/hintamerkinnät pidettiin vaaleina ja neutraaleina. Kartan `Kohtaamispaikat`- ja `Maksullinen`-kytkimet erotettiin omaksi 44 px:n tasoryhmäksi; maksullisissa käytetään Coins-ikonia.
- Yläpalkin sijainti- ja sädelinkki sai hillityn pilleritaustan, sijainti-ikonin sekä hover- ja näppäimistöfokustilan.

## 2026-11-28 — Oletusrajauksen fallback ja korttien toimivuus

- Tapahtumien ikäryhmävertailu normalisoi en- ja em-viivat; jos oletusrajaus ei löydä yhtään osumaa, alueen tulokset näytetään ja fallback kerrotaan erikseen.
- Etusivun perhekaruselli näyttää rajausehtojen tyhjentyessä olemassa olevat keskinäiset mätsit tai kertoo demoprofiilien rajallisuudesta ja suodattimien laajentamisesta.
- Perhekorttien liukuvärit vaihdettiin yhtenäiseen salvia-aksenttiin. Kartan perhekortti valitsee perheen ja kohdistaa kartan sen koordinaatteihin; tapahtumakortteihin lisättiin päivämäärälaatikot.

## 2026-11-28 — Korttien viimeistely

- Perhe- ja tapahtumakorttien yläreunan väripalkit poistettiin; päivämäärälaatikoiden hillityt taustat säilytettiin.
- Etusivun tapahtumaruudukko säilyy mobiilissa yksipalstaisena ja tablettileveydellä kaksipalstaisena. Tapahtumaotsikoiden paino yhtenäistettiin kevyemmäksi, ja kartan päivämääränumero käyttää etusivun numerofonttia kompaktissa koossa.

