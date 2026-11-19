# Rozhlas 68

Prototyp audiowalku: telefon funguje jako anténa. Podle směru z kompasu hraje stanice, na kterou míříš, a mezi stanicemi je slyšet šum.

## Úpravy

Vše podstatné je v `config.js`:

- `stations` – seznam stanic: `name`, `file` (cesta k MP3), `bearing` (azimut ve stupních, 0 = sever, 90 = východ).
- `stations[].freq` – frekvence stanice v MHz pro režim Frekvence.
- `radio` – rozsah stupnice (`min`, `max`), výchozí frekvence (`start`), šířka příjmu v MHz (`bandwidth`) a kolik MHz ujede jedna otáčka knoflíku (`mhzPerTurn`).
- `beam` – poloviční šířka výseče příjmu ve stupních. Čím menší, tím přesněji je potřeba mířit.
- `noiseLevel` – hlasitost šumu mezi stanicemi, `noiseFloor` – šum, který je slyšet vždy.

MP3 soubory patří do `audio/`. Současné ukázky jsou 90s úseky z audiowalku Korzo 2023 (audiowalk-cz/audiowalk-korzo-2023, stopy 1, 2, 3 a 5).

## Spuštění

Stránka je čistě statická. Kompas v prohlížeči funguje jen přes HTTPS (GitHub Pages), lokálně stačí `python3 -m http.server` a ruční posuvník.

- iOS: přístup ke kompasu se povolí po klepnutí na „Zapnout přijímač“.
- Android: používá se `deviceorientationabsolute`.
- Bez kompasu se směr nastavuje posuvníkem „Ruční směr“.
