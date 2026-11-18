# DesktopSim · Betriebssystem-Labor

Statische HTML/CSS/JS-App für GitHub Pages: neun Betriebssysteme mit originalgetreuer Bedienung, einer echten Shell und **Programmiersprachen, die wirklich laufen** – ohne Installation, ohne Server, ohne Build-Schritt.

## Starten

Den Ordner `DesktopSim/` in die GitHub-Pages-Seite übernehmen und verlinken (`<a href="/DesktopSim/">`). Lokal im Ordner *oberhalb*:

```bash
python -m http.server 8080   # dann http://localhost:8080/DesktopSim/
```

ES-Module und der Service Worker brauchen `http(s)://` (nicht `file://`). Direktlink zu einem System: `…/DesktopSim/#os=debian` (`winxp`, `win7`, `win8`, `win10`, `win11`, `debian`, `arch`, `macos`, `unix`).

## Echte Laufzeiten (WebAssembly, im Browser)

| Sprache | Technik | Download (einmalig, danach im Cache) |
| --- | --- | --- |
| Python 3.14 | Pyodide; `input()`, Dateizugriff, `pip install`, Matplotlib-Grafiken | ≈ 10 MB |
| JavaScript | Browser-Engine im Worker; `console`, `prompt()`, `require('fs')`, `readline`, Node-REPL | – |
| C / C++ | Clang/LLVM 22 (YoWASP) → WASI-Programm, eigener WASI-Lader | ≈ 100 MB |
| Java 8 | echtes `javac` (OpenJDK tools.jar) + CheerpJ-JVM, interaktiver `Scanner` | ≈ 30 MB |
| PHP 8.4 | php-wasm, auch als `php -S localhost:8000` mit GET/POST | ≈ 13 MB |
| SQLite 3 | sql.js, Datenbanken in IndexedDB | ≈ 1 MB |
| C# | nur Ausgabe-Demo (keine .NET-Laufzeit im Browser) | – |

**Interaktive Eingabe:** Programme laufen in Web Workern. Liest ein Programm von stdin, blockiert es per synchronem XHR auf `__ds_io__/read`; der Service Worker (`sw.js`) beantwortet die Anfrage, sobald das Terminal eine Zeile liefert. Das funktioniert auf GitHub Pages ohne `SharedArrayBuffer`/COOP/COEP. Derselbe Service Worker cached die großen Laufzeit-Downloads dauerhaft.

**Grenzen:** C++-Exceptions (`throw`/`try`) sind im verwendeten Sysroot nicht verfügbar (`-fno-exceptions`), keine Threads. Java-Programme lassen sich mit Strg+C nur abkoppeln, nicht hart beenden. Ohne Internet beim ersten Start greifen vereinfachte Offline-Fallbacks (`assets/runtimes.js`).

**Lizenzen/Dienste:** Pyodide (MPL-2.0), YoWASP Clang (ISC/Apache-2.0 LLVM), php-wasm (Apache-2.0/PHP), sql.js (MIT), CheerpJ Community Edition (kostenlos für private und schulische Nutzung, „Built with CheerpJ“), `tools.jar` aus OpenJDK 8 (GPLv2+CE) über das öffentliche JavaFiddle-Repository. Code der Nutzer wird nicht an Server gesendet.

## Shell

Bash (Debian/Arch), Zsh (macOS), sh (Unix), CMD und PowerShell (Windows) mit gemeinsamem Parser:

- Pipes, `>`/`>>`/`<`/`2>`/`2>&1`, `&&`, `||`, `;`, Variablen, `$(…)`, `$((…))`, Wildcards, Exitcodes (`$?`, `%ERRORLEVEL%`)
- Skripte: `if`/`for`/`while`, `chmod +x skript.sh && ./skript.sh` (inkl. „Keine Berechtigung“), Batch-Dateien (`set /p`, `if exist`, `goto`, `pause`), PowerShell-Skripte samt Ausführungsrichtlinie
- über 150 Befehle (u. a. `ls`, `grep`, `sort`, `uniq`, `cut`, `sed`, `find`, `tree`, `ps`, `top`, `df`, `ping`, `curl`, `man`, `neofetch`; `dir`, `findstr`, `tasklist`, `taskkill`, `ipconfig /all`; `Get-ChildItem`, `Write-Host`, `Read-Host` …)
- `sudo` mit Passwortabfrage, Paketmanager (`apt`, `pacman`, `brew`, `winget`) mit realistischer Ausgabe; Spaßpakete (`cowsay`, `sl`, `fortune`, `lolcat`, `fastfetch`) werden erst nach der Installation verfügbar
- deutsche Systemmeldungen wie auf einem deutsch eingestellten Rechner

## Oberflächen

Startseite → Boot (BIOS/GRUB/Logo) → Anmeldung/Sperrbildschirm → Desktop. Je System eigene Fensterrahmen, Startmenüs (XP zweispaltig, 7 mit Suche, 8 Startbildschirm, 10 mit Kacheln, 11 zentriert), GNOME-Aktivitäten, KDE-Kickoff, macOS-Menüleiste/Dock/Launchpad/Spotlight, CDE-Frontpanel mit vier Arbeitsbereichen. Fenster: Größe an allen Kanten, Andocken mit Vorschau, Snap-Layouts (11), Minimieren-Animation, Übersicht (Strg+Alt+O). Desktop-Symbole verschiebbar, Mehrfachauswahl, Kontextmenüs, Papierkorb mit Wiederherstellen.

Apps: Terminal (Windows-Terminal mit Tabs unter 11), Dateimanager (Explorer/Finder/Nautilus/Dolphin/dtfile, Drag & Drop, Upload/Download), Editor, IDE mit integriertem Terminal, Browser (localhost, `file://`, datenflix007.github.io), Einstellungen, Task-Manager, Rechner, SQL Studio, Git Graph, Struktogramm-Werkstatt, OS-Spiele, Fun Lab, Anleitung.

Tastenkürzel: Strg+Esc Startmenü/Aktivitäten · Strg+Alt+T Terminal · Strg+Umschalt+Esc Task-Manager · Strg+Alt+D Desktop · Strg+Leertaste Spotlight (macOS).

Alle Oberflächen sind eigene Nachbildungen; es werden keine originalen Betriebssystem-Dateien oder Logos ausgeliefert.

## Daten

`localStorage` (Dateisystem, Einstellungen, Pakete, Git) und IndexedDB (kompilierte Programme, SQLite-Datenbanken), getrennt je System. Sicherung/Wiederherstellung über Einstellungen → Speicher.

## Ordnerstruktur

```text
DesktopSim/
├── index.html            Startseite + Desktop-Gerüst
├── sw.js                 Service Worker: stdin-Brücke + Laufzeit-Cache
├── assets/
│   ├── app.js            Kern: Start/Boot, Fenstermanager, Desktop
│   ├── terminal.js       Shell-Engine (Bash/Zsh/sh, CMD, PowerShell)
│   ├── shell/            Parser und Programme (Sprachen, Paketmanager, Netzwerk)
│   ├── runtime/          Worker für Python, JS, Clang, WASI, PHP; Java (CheerpJ); SQLite
│   ├── ui/               OS-Oberflächen, Terminalansicht, Symbole, Profile
│   ├── apps/             Terminal, Dateien, Editor/IDE, Browser, Systemprogramme, klassische Apps
│   ├── vfs.js            virtuelles Dateisystem
│   ├── os-shell.css      Systemoberflächen   ·   os-apps.css   App-Inhalte
│   └── styles.css        Stile der klassischen Apps
└── tests/smoke.mjs       node tests/smoke.mjs (Node 20+)
```
