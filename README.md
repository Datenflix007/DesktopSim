# DekstopSim · Interaktives Betriebssystem-Labor

**Version 1.0** · Statische HTML/CSS/JS-App für GitHub Pages. Keine Installation, kein Buildprozess, kein Tracking.

## Starten

1. Den Ordner `DekstopSim/` vollständig in das Hauptverzeichnis deiner GitHub-Pages-Seite übernehmen (z. B. `Datenflix007.github.io/DekstopSim/`).
2. Committen und pushen. GitHub Pages veröffentlicht die Unterseite anschließend unter `https://datenflix007.github.io/DekstopSim/` **wenn** dieses Repository als GitHub-Pages-Quelle eingerichtet ist.
3. Den Link auf deiner Hauptseite setzen:

```html
<a href="/DekstopSim/">DekstopSim – Betriebssystem-Labor</a>
```

Für eine Projektseite unter `https://USERNAME.github.io/REPO/` statt eines User-Sites-Root den **relativen** Link `./DekstopSim/` benutzen.

Zum lokalen Testen im Ordner *oberhalb* von `DekstopSim/`:

```bash
python -m http.server 8080
# Aufrufen: http://localhost:8080/DekstopSim/
```

ES-Module benötigen einen Webserver; HTML nicht einfach mit `file://` öffnen.

## Betriebssysteme

| Oberfläche | Standard-Shell | Beispiele |
| --- | --- | --- |
| Windows XP | CMD | `dir`, `cd`, `type`, `ipconfig`, `ver` |
| Windows 7 | CMD | `dir`, `tree`, `copy`, `notepad` |
| Windows 8 | CMD | `mkdir`, `del`, `systeminfo` |
| Windows 10 | CMD / PowerShell | `powershell`, `Get-ChildItem`, `Get-Content` |
| Windows 11 | PowerShell / CMD | `Get-Location`, `Set-Location`, `cmd` |
| Debian | Bash | `ls -la`, `cat`, `apt install` (Simulation) |
| Arch | Bash | `ls`, `pacman -S` (Simulation) |
| macOS | Zsh | `ls`, `open`, `brew install` (Simulation) |
| Unix / CDE | sh | `uname -a`, `ps`, `pkginfo` (Simulation) |

Oberflächen sind **stilistische Lernnachbildungen**, keine pixelgenauen Kopien der Markenoberflächen. Es werden keine proprietären OS-Assets ausgeliefert.

## Eingebaute Apps

- **Terminal:** beliebig viele Fenster, eigene Arbeitsverzeichnisse und Kommandoverläufe, Tab-Vervollständigung, getrennte Prompts, Eingabehilfe.
- **Dateimanager:** virtuelle Ordner und Dateien, erstellen, löschen, öffnen, als Text herunterladen.
- **Editor:** Python, HTML, SQL, Java, C, C++, JavaScript, C# und PHP editieren; `Ctrl+S` speichern; **Ausführen**-Schaltfläche.
- **IDE:** VS-Code-ähnlicher Arbeitsplatz mit Projekt-Explorer, Datei-Tab, Ausgabefenster, Statusleiste und lokalem Syntax-Highlighting für die vorhandenen Lernsprachen. Über das Desktop-Icon oder mit `ide <datei>` bzw. `code <datei>` im Terminal starten; `Ctrl+S` speichert, `Ctrl+Enter` führt aus.
- **Git Graph:** lokale Lernansicht für Commit-Historie, Branches und Staging-Area. Dateien stagen, Branches anlegen/wechseln und Commits erzeugen; erreichbar über das Desktop-Icon sowie `git graph`, `git status`, `git add`, `git commit -m`, `git branch` und `git switch`.
- **Fun Lab:** rein lokale Spielereien für zwischendurch: Matrix-Bildschirmschoner (`matrix`, mit `Esc` beenden), Konfetti (`party`) und der klickbare Desktop-Begleiter Byte (`byte`). Über **Fun Lab** oder als Konami-Easter-Egg `↑ ↑ ↓ ↓ ← → ← → B A` erreichbar.
- **Struktogramm:** Anweisungen, Bedingungen sowie `for`-/`while`-Schleifen als bearbeitbaren Ablauf anlegen; einfachen Python- oder JavaScript-Code daraus erzeugen, zurück einlesen und im Editor ablegen.
- **OS-Spiel:** Ein vollständig lokaler Spieleslot, der sich mit dem System ändert: Klondike-Solitaire unter Windows XP, Minesweeper unter Windows 7–11, Tux-Snake unter Debian/Arch/Unix sowie Drei gewinnt unter macOS.
- **Browser:** HTML/CSS und JavaScript werden in einem abgeschotteten `iframe sandbox="allow-scripts"` gerendert. `localhost` wird innerhalb der App emuliert. Auf Wunsch lädt der Browser außerdem ausschließlich `https://datenflix007.github.io/` in einem getrennten iframe, sodass dessen Seiten im Fenster weitergeklickt werden können.
- **SQL Studio:** Datenbanktabellen, SELECT, WHERE, ORDER BY, LIMIT, COUNT, INSERT, UPDATE, DELETE, CREATE/DROP TABLE. **Eigene Lernengine, kein vollumfängliches SQLite.**
- **Lernhilfe:** OS-spezifische Beispiele, Erklärung der Grenzen.

## Sprachen und technische Grenzen

| Fähigkeit | Technische Umsetzung |
| --- | --- |
| Dateisystem | Virtuelle JavaScript-Struktur, isoliert nach Betriebssystem, mit `localStorage` |
| Windows/Linux/macOS/Unix-Kommandos | JS-Befehls-Emulator (nur dokumentierter Teilumfang) |
| HTML/CSS/JavaScript | Echter Browser-Renderer / JS im isolierten iframe |
| Python | Echtes Pyodide (WebAssembly) in einem **Web Worker**, per CDN beim ersten Start; begrenzte Offline-Demo wenn CDN nicht erreichbar |
| Java | `javac Main.java` prüft den Quelltext und erstellt ein virtuelles Lern-Artefakt; `java Main` zeigt eine begrenzte `System.out.println`-Ausgabe. Kein JVM oder nativer Compiler |
| C / C++ | `gcc hello.c -o hallo` und `g++ main.cpp -o hallo` prüfen typische Einstiegsfehler, legen ein virtuelles Lern-Artefakt an und erlauben `./hallo` bzw. `hallo.exe`. Kein nativer GCC-/Clang-Prozess |
| JavaScript | `node hello.js` zeigt eine begrenzte `console.log`-Ausgabe; HTML-Dateien laufen weiterhin isoliert im Browser-iframe |
| C# | Simulierte `Console.WriteLine`-Ausgaben, keine .NET-Runtime |
| PHP | Simulierte `echo`-Ausgaben, kein echter PHP-Interpreter |
| SQL | Implementierter CRUD-Teilumfang in JavaScript mit persistenter In-Memory-Datenbank |
| Git | Persistente Browser-Lernsimulation für lokale Commits, Staging und Branches; keine echten Repository-Dateien, Remotes, Pushes oder Git-Prozesse |
| `python -m http.server`, `php -S`, `curl localhost` | Virtueller Server-Router **innerhalb der Anwendung**; keine echten Listener oder Netzwerkports |
| `ping`, `ipconfig`, `apt`, `pacman`, `brew` | Exemplarische Ausgaben; kein echter Hardware-, Netzwerk- oder Paketmanagerzugriff |

Python ist die einzige integrierte vollwertige Programmiersprachen-Runtime und benötigt beim ersten Start eine Internetverbindung zu **jsDelivr/Pyodide**. Alle übrigen Kernfunktionen benötigen keine externen CDNs. Die Python-Ausführung hat bewusst **keinen Schreibzugriff auf das virtuelle JS-Dateisystem** (der Quelltext wird an den Worker übergeben). Durch „Stop Python“ kann ein festhängender Worker beendet werden. Für eine echte JVM, .NET oder serverseitiges PHP wäre ein Backend oder viel umfangreicheres WebAssembly-Bundle nötig, was GitHub Pages nicht von sich aus bereitstellt.

## Daten / Datenschutz

- Die Beispieldateien sind lokal im Code gebündelt; Veränderungen werden im `localStorage` des **jeweiligen** Browsers gespeichert.
- SQL-Lerndaten bleiben pro Betriebssystem getrennt im `localStorage`.
- Kein Login, keine Telemetrie und keine Backend-Datenübertragung. **Ausnahme:** Auf Abruf wird Pyodide vom CDN heruntergeladen; die ausdrücklich ausgewählte Datenflix-Seite wird über GitHub Pages geladen.
- Backup: Button **Export** im Header (JSON). **Import** im Startmenü. Import ist an das ursprüngliche simulierte OS gebunden.
- Virtuelle Nutzerdaten werden mit **Zurücksetzen** gelöscht; bei einem Browser-Cache-Reset können sie ebenfalls verloren gehen.
- Die HTML-Vorschau ist ein eingeschränktes Sandbox-iframe ohne `allow-same-origin`; HTML und JS fremder Autoren trotzdem nur nach sorgfältiger Prüfung verwenden.

## Ordnerstruktur

```text
DekstopSim/
├── .nojekyll
├── index.html
├── README.md
└── assets/
    ├── styles.css
    ├── app.js                # UI / Fenstermanager
    ├── vfs.js                # OS-Profile / virtuelle Dateien
    ├── terminal.js           # OS-spezifischer Kommando-Emulator
    ├── runtimes.js           # SQL-Lernengine / Runtime-Verwaltung
    ├── python-worker.js      # Python via Pyodide im Worker
    └── favicon.svg
```

## Beispiel-Übungen

**Windows 11:** `dir` → `code hello.py` → `powershell` → `Get-ChildItem` → `python hello.py` → `g++ main.cpp -o hallo` → `hallo.exe`.

**Debian:** `pwd` → `ls -la` → `cat index.html` → `python3 -m http.server 8000` → Browser `http://localhost:8000`.

**Arch:** `uname -a` → `pacman -S python` (Demoinfo) → `ls` → `g++ main.cpp -o hallo` → `./hallo`.

**SQL:** `sqlite3 demo.db` → `SELECT * FROM schueler;` → `INSERT INTO schueler (name, klasse, punkte) VALUES ('Mira', '9b', 92);` → `SELECT * FROM schueler WHERE punkte >= 90 ORDER BY punkte DESC;` → `.exit`.

**OS-Spiel:** Auf dem jeweiligen Desktop das Icon **OS-Spiel** doppelklicken. Bei Minesweeper markierst du vermutete Minen mit der rechten Maustaste; Tux-Snake lässt sich mit Pfeiltasten oder den sichtbaren Richtungstasten steuern.

## Einbindung in bestehende Webseiten

DesktopSim ist absichtlich als separate HTML-Unterseite aufgebaut und benötigt keine Abhängigkeiten deiner Hauptseite. Einfach den kompletten Ordner kopieren und im Header / Projektbereich darauf verlinken. Relative Asset-Pfade funktionieren auch in einem Unterverzeichnis oder eigenständigen GitHub-Pages-Repository.

## Grenzen und Entwicklungsbedarf

**Nicht** implementiert: echte virtuelle Maschinen/Kernels, vollständige Shell-Parser, Pipes, Jobs/Prozesse, echtes PostgreSQL/MySQL/SQLite, VM-Netzwerk, POSIX-Rechte, Framework-Support oder vollständige Java/.NET/PHP-Ausführung. Der Schwerpunkt liegt auf erkennbaren Oberflächen, grundlegenden Befehlen und niedrigschwelligen Unterrichtsübungen.

## Entwickler-Selbsttest

Ohne NPM-Installation, nur mit Node.js 20+:

```bash
cd DekstopSim
node tests/smoke.mjs
```

Dieser Test prüft alle neun Betriebssystemprofile, typische Befehle, Ordnererstellung, Terminal-SQL, simulierten localhost, SQL-Filter/CRUD, Sprach-Demos, lokale Persistenz sowie die Einbindung von Struktogramm und Browser-Freigabe.
