# Shellproton muutosloki

## Versiointiperiaate

Versio muodostuu muodossa `MAJOR.MINOR.PATCH`.

- Versioidaan vain tuotantopushit, ei jokaista koodimuutosta.
- **MAJOR** kuvaa arkkitehtuurivaihetta tai merkittävää valmiusmuutosta. `0.x.x` merkitsee Figma-lähtöä (17.11.2026), `1.x.x` Figmasta siirtymistä (23.11.2026) ja `2.x.x` Vercel-ympäristöä (27.11.2026). Jatkossa MAJOR vaihtuu isossa arkkitehtuurimuutoksessa tai siirryttäessä testausvaiheeseen.
- **MINOR** on tuotantopushin päivämäärän ja aloituspäivän 17.11.2026 välinen päiväero. Esimerkiksi 28.11.2026 on päivä 11, joten nykyisen arkkitehtuurivaiheen versionumero alkaa `2.11`.
- **PATCH** on saman päivän tuotantopushien järjestysnumero alkaen nollasta (`0`, `1`, `2`, ...). Uusi päivä kasvattaa MINOR-osaa ja aloittaa PATCH-osan uudelleen nollasta.

Esimerkiksi `2.11.0` tarkoittaa Vercel-arkkitehtuurivaihetta, 11. päivää aloituksesta ja päivän ensimmäistä tuotantopushia.
