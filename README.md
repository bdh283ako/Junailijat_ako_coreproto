# Junailijat – Perheiden tapahtuma- ja yhteisöprototyyppi (`shellproto`)

> **Huomio:** Tämä repositorio on Haaga-Helian opintojaksoon **`DIG002AS2A-3021`** liittyvä kehitys- ja arkkitehtuuriprototyyppi. Älä syötä demo- tai kehitysympäristöön oikeita kotiosoitteita tai arkaluonteisia henkilötietoja.

## Kurssiyhteys ja tiimi

* **Opintojakso:** **Innovointi ja prototyypin rakentaminen** (`DIG002AS2A-3021`, `5 op`, suomi, Haaga-Helia ammattikorkeakoulu – IT-tradenomi, Digitaaliset palvelut)
* **Toteutuksen opettajat:** Heikki Hietala ja Pekka Karimaa
* **Tiimi (`Junailijat`):** Antti, Karo, Jutta ja Niina
* **Demo ja pitch:** 8.12.2026

### Kurssin ydin ja osaamistavoitteet (`DIG002AS2A`)

Opintojakson ytimessä on käytännön ongelman tunnistaminen, ideointi ja konseptointi tiimissä sekä toimivan prototyypin rakentaminen, testaaminen ja vakuuttava esittäminen (pitchaus) visuaalisia apuvälineitä hyödyntäen. Keskeisiä sisältöalueita ovat:

* Innovointiprosessi ja luova ongelmanratkaisu
* Ideointi- ja konseptointimenetelmät
* Prototypointi ja testaaminen
* Tiimityö, vuorovaikutus ja reflektio
* Pitchaus ja innovaatioiden esittäminen

*(Valinnainen täydennys Moodlesta: lisätään tähän, jos Moodlen toteutuskohtaisessa kuvauksessa on tarkempia tehtävä- tai arviointikohtia.)*

---

## Arkkitehtuuri ja dokumentaatio

Sovelluksen rakenne ja kehitysympäristö kuvataan **Architecture-as-Code**-periaatteella suoraan versionhallinnassa:

* **[Sovellus- ja moduuliarkkitehtuuri (Mermaid)](./docs/ARKKITEHTUURI.md)** – GitHubissa suoraan renderöityvät kaaviot paikallisesta `localhost`-ympäristöstä sekä `shellproto`-moduulijaosta.
* **[Paikallinen kehitysympäristö (PlantUML)](./docs/arkkitehtuuri_localhost.puml)** – Next.js 16 App Router-, Payload CMS 4-, Docker/PostgreSQL 17-, Auth.js Google OAuth- ja ulkoisten tapahtumasyötteiden rajapintakuvaus.
* **[Shellproto-komponenttikaavio (PlantUML)](./docs/arkkitehtuuri_shellproto.puml)** – UI-paneelien, custom-hookkien ja apumoduulien nykytila ja refaktorointivaiheet (`vaihe 1` → `vaihe 4b`).
* **[AI-agenttisäännöt (`.clinerules`)](./.clinerules)** – Ohjeet arkkitehtuurikaavioiden lukemiseen ja synkronoimiseen koodimuutosten yhteydessä.

---

## Teknologiapino

* **Frontend & Fullstack:** Next.js `16.4.6` (App Router), React `19.3.1`, TypeScript `6.0.3`, Tailwind CSS
* **CMS & Tietokanta:** Payload CMS `4.0.0-beta.8` (`@payloadcms/db-postgres`), PostgreSQL `17` (`postgres:17-alpine`) Docker Compose -kontissa
* **Autentikointi:** Auth.js / NextAuth (`5.0.0-beta.32`) Google OAuth 2.0 / OIDC
* **Ulkoiset tapahtumalähteet:** EventPulse (JSON-LD), Linked Events API (Helsinki, Espoo, Vantaa) sekä Kauniaisten tapahtumahaku

---

## Pika-aloitus paikallisesti (`localhost`)

### Esivaatimukset
* Node.js `>= 24.22.1` (kehityksessä käytetty `26.13.1`)
* `pnpm` (`9`, `10` tai `11`; kehityksessä käytetty `10.34.9`)
* Docker ja Docker Compose

### Käynnistysvaiheet

1. **Siirry kehityshaaraan ja asenna riippuvuudet:**
   ```bash
   git checkout feat/ako
   pnpm install
   ```

2. **Käynnistä paikallinen PostgreSQL 17 -tietokanta Dockerilla:**
   ```bash
   docker compose up -d
   ```

3. **Aseta ympäristömuuttujat:**
   Varmista `.env`-tiedostossa tietokantayhteys (`DATABASE_URL`), Auth.js-salaisuus (`AUTH_SECRET`) sekä Google OAuth -tunnisteet (älä koskaan commitoi `.env`-tiedostoa).

4. **Käynnistä kehityspalvelin:**
   ```bash
   pnpm dev
   ```
   Sovellus avautuu osoitteessa `http://localhost:3000` (kokeilunäkymä polussa `/akotestaa/shellproto`).

5. **Valinnainen kertaluonteinen vanhan datan tuonti:**
   ```bash
   pnpm data:import-legacy
   ```

---

## Kehityskäytännöt

* Pidä `page.tsx` koordinaattorina ja pilko erilliset näkymät `*Panel.tsx` / `*View.tsx` -komponenteiksi sekä sivuvaikutukset `use*.ts`-hookeiksi.
* Säilytä `localStorage` vain kokeilunäkymien paikallisessa ja lukukuittausten kaltaisessa transientissa tilassa — pysyvä data kulkee Payloadin ja PostgreSQL:n kautta.
* Päivitä `.puml`-kaaviot ja `docs/ARKKITEHTUURI.md` aina kun rajapinnat, tietokanta tai moduulirakenne muuttuvat.
* Varmista tyyppiturvallisuus ennen muutosten viimeistelyä komennolla `npx tsc --noEmit`.