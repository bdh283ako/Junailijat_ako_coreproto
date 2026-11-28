# EventPulse (`feed.jsonld`) — integraatiomalli

EventPulse on valinnainen tapahtumalähde; se ei ole `/api/events`-reitin pakollinen riippuvuus.

## Päätepiste ja käyttö

- **Syöte-URL:** `https://eventpulsebyjunailijat.ai.studio/api/events/feed.jsonld?horizon=all` (tai ympäristömuuttujalla `KARO_EVENTPULSE_URL`)
- **Tunnistautuminen / avaimet:** Koodi käyttää julkista syötettä ilman API-avainta. `Accept: application/ld+json, application/json`.
- **Aikakatkaisu:** Mittaus 28.11.2026: 8,674 s (HTTP 200), johdettu aikakatkaisu 13011 ms (mitattu aika × 1,5). EventPulse ei jaa yhteistä 3000 ms -pullonkaulaa muiden lähteiden kanssa; valmis 60 s välimuistitulos palautetaan välittömästi ja EP päivittyy taustalla.

## Datamalli ja sijainnot (JSON-LD)

- **Tapahtumat / kohteet:** Koodi lukee `events`, `items`, `data`, `content`, `results`, `hits`, `@graph` tai JSON-LD:n yksittäisen Event-kohteen ja normalisoi sen `NormalizedFeedEvent`-malliin.
- **Sijainnot ja koordinaatit:** Käytössä ovat `coordinates`, `location.geo`, `location.coordinates` sekä lat/lng- ja latitude/longitude-kentät; puuttuvat tai alueen ulkopuoliset koordinaatit korvataan karttaratkaisussa PKS-fallbackilla.
- **Kohderyhmät, ikä ja tägit:** Iän ja samankaltaisten kenttien arvoista muodostetaan ikämerkintä; tulokset yhdistetään kanonisiin tägiin muiden lähteiden kanssa.

## Huomiot integraatioon

- Syöte ajetaan omassa vikasietoisessa haarassaan (`Promise.allSettled` + aikakatkaisu), jotta se ei estä tai hidasta muita lähteitä, jos syöte on alhaalla tai tyhjä.
