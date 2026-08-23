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
