# Lähellä.fi integraatiorajapinta (`v1/integration`)

Lähellä.fi:n avoin REST-rajapinta toimii ilman API-avainta ja täydentää Junailijoiden / PerhePiirin tapahtuma- ja yhteisösyötettä järjestöjen ja yhdistysten toiminnalla.

## Päätepisteet

- **Käyttöohjeet ja ehdot:** `https://www.lahella.fi/lahellafi-api---kayttoohjeet-ja-ehdot`
- **Toimintailmoitukset:** `https://www.lahella.fi/v1/integration/activities/`
- **Rekisteröityneet organisaatiot:** `https://www.lahella.fi/v1/integration/groups/`
- **Metadata ja kyselyparametrit:** `https://www.lahella.fi/v1/integration/metadata/`
- **TypeScript-tyypit:** `https://www.lahella.fi/v1/integration/ts/`

## Käyttöperiaatteet toteutuksessa

- **Ei API-avainta:** Pyynnöt tehdään julkiseen rajapintaan ilman tunnistautumisavainta.
- **Kyselyparametrit ja tyypit:** Tarkista sallitut parametrit ja arvot `metadata/`-päätepisteestä ja hyödynnä `ts/`-tyyppejä mallinnuksessa.
- **Vikasietoisuus (`/api/events`):** Lähellä.fi haetaan omassa eristetyssä haarassaan (`Promise.allSettled` + aikakatkaisu), jotta viiveet tai virheet eivät kaada Linked Events- tai EventPulse-syötteitä.
- **Alue- ja koordinaattikäsittely:** Rajaa pääkaupunkiseudulle (Espoo, Helsinki, Vantaa, Kauniainen) ja käytä kunta-/aluekoordinaattien fallbackia (`pksAreas`), jos yksittäiseltä kohteelta puuttuu tarkka koordinaatti.
- **Kanoniset tägit ja tietosuoja:** Mäppää kohderyhmät ja sisällöt yhteisiin kanonisiin tägeihin; älä paljasta kenenkään tarkkaa kotiosoitetta tai koordinaattia ulospäin ilman mätsiä ja erillistä suostumusta.
- **Sivutus:** Toteutus käyttää `pageSize=50` ja `page=1…5`; jokainen vastaus pysäyttää haun, kun `hasMore` on epätosi. API:n koordinaatit ovat GeoJSON-muodossa `[longitude, latitude]`; sovellus muuntaa ne `[latitude, longitude]`-muotoon.
- **Mittausperuste:** 28.11.2026 mitattu vasteaika oli 1,609 s (HTTP 200). Aikakatkaisu on 2413 ms (mitattu aika × 1,5). Lähellä.fi ei jaa yhteistä 3000 ms -pullonkaulaa EventPulseen tai Linked Eventsiin; vastaus käyttää 60 s palvelinvälimuistia.