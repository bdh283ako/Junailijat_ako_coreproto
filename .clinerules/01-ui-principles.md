# UI- ja saavutettavuussäännöt

UI-tehtävän alussa lue `docs/UI_DESIGN_PRINCIPLES.md` ja `docs/UI_ACCESSIBILITY_CHANGELOG.md` (sekä tarvittaessa `docs/arkkitehtuuri_shellproto.puml`, jos komponenttirakenne muuttuu). Ne määrittelevät käyttöliittymän suunnan, saavutettavuuden ja aiemmin tehdyt ratkaisut.

- Säilytä mobiili- ja tablettiskaalautuvuus. Käytä yhtä joustavaa näkymää; älä tee erillistä desktop-versiota, sivupalkkia tai sullouda sisältöä pienille näytöille.
- Estä vaakasuuntainen ylivuoto (`overflow-x`) kapeassa mobiilikoossa (`375px–430px`) ja tabletissa; käytä `min-w-0` ja rivittymistä (`flex-wrap`) tarvittaessa.
- Älä muuta pelkässä UI-tehtävässä sovelluksen toiminnallisuutta, API-reittejä, reititystä, tilanhallintaa tai komponenttien proppeja. Pidä muutos ulkoasussa, nimissä/linkeissä ja käyttöliittymän rakenteessa vain siltä osin kuin pyydetty.
- Noudata WCAG 2.1/2.2 AA -kontrasteja. Käytä vähintään 44 × 44 px:n kosketusalueita ja säilytä näkyvä, 3 px:n `:focus-visible`-kehys.
- Käytä `Momo Trust Display` -fonttia otsikoihin ja `Inter`-fonttia leipätekstiin ja käyttöliittymään. 
- Käytä väri- ja kontrastipäätöksissä suunnitteluperiaatedokumentin tokeneita (`#9E4B16` terrakotta, `#9CB9B7` salvia, `#F0EEE9` / `#F7F6F3` pinnat, `#2E211B` tumma teksti). Valkoinen teksti ei kuulu salvian `#9CB9B7` päälle; käytä sen kanssa tummaa `#2E211B`-tekstiä.
- Säilytä dokumentoidut tuoterajaukset: ei Palvelut-osiota, käytä käsitettä ”Yhteisö” ja pidä etusivun rakenne (1 × 3 -pikavalinta, perheiden swipe-näkymä, tapahtumien pystysuuntainen scrollaus sekä laajeneva karttakerros) tunnistettavana.
- Tee yksi rajattu muutos kerrallaan. Jos pyyntö edellyttäisi yllä olevien rajojen muuttamista, älä tee muutosta omin päin. Pyydä ensin tarkennus tai hyväksyntä.