# Junailijat – käyttöliittymän suunnittelu- ja saavutettavuusperiaatteet

Tämä on yhteinen, helposti silmäiltävä lähtökohta Junailijoiden käyttöliittymälle. Tavoitteena on lämmin, rauhallinen ja selkeä näkymä, jota perheet voivat käyttää vaivattomasti puhelimella ja tabletilla. Periaatteet ovat yhteisiä myös silloin, kun toteutusta tai ulkoasua ehdotetaan yhdessä Jutan ja Niinan kanssa.

## 1. Näkymä kaiken kokoisille laitteille

- Suunnittele ensin puhelimelle ja pidä sisältö yhtä lailla toimivana tabletilla. Käyttöliittymä mukautuu joustavasti käytettävissä olevaan tilaan.
- Älä tee erillistä desktop-versiota. Suuremmalla näytöllä sisältö voi pysyä keskitettynä ja sopivan levyisenä sen sijaan, että se venyy tarpeettoman leveäksi.
- Vältä ahtaita rivejä, päällekkäisiä elementtejä ja sivun vaakasuuntaista vieritystä. Tekstin pitää mahtua myös pienelle näytölle ja säilyä luettavana suurennettuna.
- Pidä painikkeet, linkit ja muut kosketettavat kohteet vähintään **44 × 44 pikselin** kokoisina. Älä pienennä niitä tilan säästämiseksi.
- Perheiden korttien swipe-näkymässä vaakasuuntainen selaus on tarkoituksellinen: tee sen käyttö ymmärrettäväksi ja varmista, ettei se aiheuta muun sivun vaakasuuntaista ylivuotoa.

## 2. Saavutettavuus on osa ulkoasua

Tavoitteena on **WCAG 2.1 ja 2.2 AA** kaikissa näkymissä.

- Tavallisen tekstin kontrasti taustaansa vasten on vähintään **4,5:1**. Suuren tekstin vähimmäiskontrasti on **3:1**. Käyttöliittymän rajojen ja visuaalisten tilailmaisimien pitää erottua selkeästi.
- Näppäimistöllä liikkuvan käyttäjän fokus ei saa kadota. Käytä näkyvää **3 px:n `:focus-visible`-kehystä** ja säilytä sille tilaa ympärillä.
- Älä ilmaise tilaa pelkällä värillä. Esimerkiksi valitun tai aktiivisen kohdan pitää erottua myös tekstin, muodon tai muun tunnistettavan merkin avulla.
- Käytä tekstille skaalautuvia kokoja ja riittävää riviväliä. Sisältö ei saa leikkautua, kun tekstiä suurennetaan.
- Varmista, että painikkeilla ja linkeillä on ymmärrettävät nimet ja että rakenne on järkevä myös ruudunlukijalla.

## 3. Värit ja kontrastit

Käytä ensisijaisesti näitä sovelluksen väritokeneita ja niiden tarkoitettuja yhdistelmiä:

| Käyttö | Väri | Ohje |
|---|---|---|
| Päätausta | `#F7F6F3` | Lämmin, vaalea tausta. |
| Kortti- ja toissijainen pinta | `#F0EEE9` | Erota kortti taustasta selkeällä reunalla, älä vain varjolla. |
| Korostava terrakotta | `#9E4B16` | Käytä valkoisen tekstin kanssa; kontrasti on noin **6,05:1**. |
| Meripihka | `#BE5518` (`--color-amber`) | Lämmin toiminta- ja reitityskorostus terrakotan rinnalla; valkoisen tekstin kontrasti **4,67:1**. |
| Poltettu karmiini | `#A63A50` (`--color-carmine`) | Keskustelu-, viesti- ja aktiivisuusmerkit; valkoisen tekstin kontrasti **6,28:1**. |
| Salvia | `#9CB9B7` | Käytä tumman `#2E211B`-tekstin kanssa; kontrasti on noin **7,44:1**. |
| Pääteksti | `#2E211B` | Käytä erityisesti salvian päällä. |
| Selkeä reunaviiva | `#7E7A70` | Rajaa kortit ja syötekentät, jotta niiden reunat erottuvat. |

**Älä käytä valkoista tekstiä salvian `#9CB9B7` päällä.** Sen kontrasti ei riitä. Älä myöskään käytä vaaleaa terrakottaa `#C06225` tai esimerkkimeripihkaa `#C2591A` valkoisen tekstin taustana; niiden kontrasti alittaa AA-rajan. Käytä tekstiä sisältävissä meripihkapinnoissa `--color-amber`-tokenia (`#BE5518`). Kun tuot uuden väriyhdistelmän, tarkista kontrasti ennen käyttöä äläkä päättele riittävyyttä vain värien ulkonäöstä.

## 4. Typografia

- **Momo Trust Display** otsikoihin ja näyttäviin otsikkoteksteihin.
- **Inter** leipätekstiin, painikkeisiin, navigaatioon, tunnisteisiin ja muuhun käyttöliittymätekstiin.
- **Älä käytä Mynerve-fonttia.** Se ei kuulu Junailijoiden typografiaan.
- Pidä tekstit selkeinä ja riittävän kokoisina; vältä pitkiä, kokonaan versaaleilla kirjoitettuja tai koristeellisia leipätekstikokonaisuuksia.

## 5. Tuotteen rajat ja etusivun rakenne

Nämä ovat tunnistettavia tuoteratkaisuja, eivät vapaita uudelleensuunnittelukohtia:

- Sovellukseen **ei tule Palvelut-osiota**. Käytä yhteisestä toiminnasta ja ihmisten kohtaamisesta käsitettä **”Yhteisö”**.
- Etusivun pikavalinta on **yksi kolmen valinnan rivi (1 × 3)**, ei suuri 2 × 2 -ruudukko.
- Perheitä selataan omassa **swipe-näkymässään**.
- Tapahtumalista liikkuu **pystysuuntaisesti scrollaamalla**.
- Kartta avautuu ja laajenee **kerroksena** muun näkymän päälle; kartan ei pidä syrjäyttää etusivun muuta rakennetta pysyvästi.

Kun ulkoasua muokataan, säilytä nämä rakenteet ja niiden tarkoitus. Jos jokin pyyntö vaikuttaa niihin tai edellyttää uuden tuotealueen lisäämistä, tarkista ensin Jutan ja Niinan näkemys.

## 6. Muutosehdotukset ja palaute

Jutta ja Niina voivat ehdottaa muutoksia matalalla kynnyksellä:

- Jätä kommentti asiaankuuluvaan **GitHub-issueen tai pull requestiin**. Kuvaile lyhyesti, mitä kohtaa ehdotus koskee ja missä tilanteessa se auttaisi.
- Voit myös ehdottaa muutosta suoraan tähän tiedostoon ja avata siitä pull requestin. Näin perustelu ja muutos ovat yhdessä tarkasteltavissa.
- Jos ehdotus muuttaa tuoterajausta tai sovittua käyttötapaa, merkitse se selkeästi päätöstä vaativaksi ehdotukseksi ennen toteutusta.

## Aiheeseen liittyvät dokumentit

- [Saavutettavuusmuutosten loki](./UI_ACCESSIBILITY_CHANGELOG.md) kuvaa toteutettuja saavutettavuusratkaisuja, kontrastiarvoja ja niiden perusteita.
