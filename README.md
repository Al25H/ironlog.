# IRONLOG – Hardcore Fitness PWA

Tämä on ensimmäinen toimiva versio.

## Mitä toimii nyt
- Hardcore musta/punainen käyttöliittymä
- Ruokien lisäys grammoina
- Kalorien + proteiinin + hiilareiden + rasvan automaattinen laskenta
- Päivän makrot ja kalorimäärä etusivulla
- Treenien tallennus
- Juoksu- ja kävelylenkkien tallennus
- Älykellon screenshotin valinta ja esikatselu
- Paino ja vyötärö
- Painokäyrä
- 7 päivän yhteenveto
- Omat kalori- ja makrotavoitteet
- Tiedot tallentuvat selaimen localStorageen
- PWA-manifesti + offline service worker

## Käynnistys Windowsilla
Helpoin tapa:
1. Asenna Visual Studio Code.
2. Avaa tämä kansio VS Codessa.
3. Asenna VS Codeen "Live Server" -lisäosa.
4. Klikkaa index.html -> Open with Live Server.
5. Sovellus avautuu selaimeen.

Vaihtoehto Pythonilla:
    python -m http.server 8080
ja avaa selaimessa:
    http://localhost:8080

## iPhoneen
Kun projekti on julkaistu HTTPS-osoitteeseen (esim. Cloudflare Pages / Netlify / Vercel), avaa sivu iPhonen Safarissa:
Jaa -> Lisää Koti-valikkoon.

## Seuraava vaihe
- Screenshotin OCR/AI-luku
- Ruokatietokanta ja viivakoodi
- Apple Health myöhemmässä natiiviversiossa
- Pilvivarmistus


## V2 – automaattinen lenkin tietojen luku
- Tesseract.js OCR lukee älykellon / treenisovelluksen screenshotin suoraan selaimessa.
- Appi yrittää tunnistaa:
  - lajin
  - matkan (km)
  - ajan
  - keskivauhdin
  - keskisykkeen
  - kalorit
- Löydetyt arvot täytetään Lenkit-lomakkeeseen automaattisesti.
- Arvot kannattaa aina tarkistaa ennen tallennusta.
- OCR tarvitsee internet-yhteyden ensimmäisellä käyttökerralla, koska Tesseract.js ladataan CDN:stä.


## V3 – Ruoka 2.0
- Ruokahaku
- Sisäänrakennettu aloitusruokakanta
- Omat tuotteet
- Suosikkiruoat
- Ateriajako: aamupala, lounas, välipala, päivällinen, iltapala
- Omat tallennetut ateriat
- Kopioi eilisen koko päivä
- Kopioi eilisen valittu ateria
- Päivän iso kalorimittari ja makroyhteenveto


## V4 – Viivakoodinlukija
- iPhonen kamera avautuu suoraan Ruoka-sivulta
- Tukee EAN-13, EAN-8, UPC-A, UPC-E ja Code 128 -koodeja
- Tuotetiedot haetaan Open Food Facts -tietokannasta
- Hakee automaattisesti:
  - tuotteen nimen
  - kalorit / 100 g
  - proteiinin / 100 g
  - hiilihydraatit / 100 g
  - rasvan / 100 g
- Käyttäjä antaa vain syödyn grammamäärän ja ateriatyypin
- Viivakoodi voidaan myös syöttää käsin
- Löydetty tuote voidaan tallentaa omiin ruokiin/suosikiksi
- Kamera vaatii HTTPS-yhteyden ja iPhonessa kameran käyttöluvan
- Kaikkia tuotteita ei välttämättä löydy Open Food Factsista
