# Helsingin Linked Events — integraatiokuvaus

Linked Events täydentää `shellproto` / `PerhePiiri` -tapahtumasyötettä kaupungin ja alueen tapahtumilla osana yhtenäistä normalisointi- ja kanoninen tägi -arkkitehtuuria.

## Virallinen dokumentaatio

- Katso tarkat päätepisteet, kyselyparametrit ja tietorakenteet suoraan Helsingin kaupungin Linked Events -dokumentaatiosta (`https://api.hel.fi/linkedevents/v1/` ja kaupungin Linked Events -ohjeistus).

## Käyttö projektissa

- **Yhtenäinen malli:** Linked Events -tapahtumat normalisoidaan samaan tapahtumarakenteeseen ja kanonisiin tägeihin muiden lähteiden rinnalla.
- **Vikasietoisuus ja rytmi:** Haetaan rinnakkain hallitulla aikakatkaisulla ja sivutuksella niin, että yksittäisen lähteen viive ei hidasta tai kaada koko näkymää.
- **Alue ja kohderyhmä:** Rajataan PKS-kontekstiin ja lapsiperheille relevantteihin tapahtumiin ja suodattimiin.
- **Päätepisteet:** Helsinki, Espoo ja Vantaa haetaan samasta `/v1/event/`-rajapinnasta `division=kunta:<kunta>`-parametrilla. Käytössä ovat `format=json`, `include=location,keywords`, `start=now`, `sort=start_time`, `super_event_type=none` ja `page_size=25`.
- **Mittausperuste:** 28.11.2026 mitatut vasteajat olivat Helsinki 2,573 s, Espoo 2,068 s ja Vantaa 2,107 s (kaikki HTTP 200). Lähdekohtainen aikakatkaisu on 3860 ms (mittausten suurin arvo × 1,5). Linked Events voidaan välimuistaa 60 sekunniksi muiden lähteiden viiveestä erillään.