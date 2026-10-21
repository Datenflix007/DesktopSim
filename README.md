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
- **Editor:** Python, HTML, SQL, Java, C# und PHP editieren; `Ctrl+S` speichern; **Ausführen**-Schaltfläche.
- **Browser:** HTML/CSS und JavaScript werden in einem abgeschotteten `iframe sandbox="allow-scripts"` gerendert. `localhost` wird innerhalb der App emuliert.
- **SQL Studio:** Datenbanktabellen, SELECT, WHERE, ORDER BY, LIMIT, COUNT, INSERT, UPDATE, DELETE, CREATE/DROP TABLE. **Eigene Lernengine, kein vollumfängliches SQLite.**
- **Lernhilfe:** OS-spezifische Beispiele, Erklärung der Grenzen.

## Sprachen und technische Grenzen

| Fähigkeit | Technische Umsetzung |
| --- | --- |
| Dateisystem | Virtuelle JavaScript-Struktur, isoliert nach Betriebssystem, mit `localStorage` |
| Windows/Linux/macOS/Unix-Kommandos | JS-Befehls-Emulator (nur dokumentierter Teilumfang) |
| HTML/CSS/JavaScript | Echter Browser-Renderer / JS im isolierten iframe |
| Python | Echtes Pyodide (WebAssembly) in einem **Web Worker**, per CDN beim ersten Start; begrenzte Offline-Demo wenn CDN nicht erreichbar |
| Java | Simulierte `System.out.println`-Ausgaben, kein JVM oder Compiler |
| C# | Simulierte `Console.WriteLine`-Ausgaben, keine .NET-Runtime |
| PHP | Simulierte `echo`-Ausgaben, kein echter PHP-Interpreter |
| SQL | Implementierter CRUD-Teilumfang in JavaScript mit persistenter In-Memory-Datenbank |
| `python -m http.server`, `php -S`, `curl localhost` | Virtueller Server-Router **innerhalb der Anwendung**; keine echten Listener oder Netzwerkports |
| `ping`, `ipconfig`, `apt`, `pacman`, `brew` | Exemplarische Ausgaben; kein echter Hardware-, Netzwerk- oder Paketmanagerzugriff |

Python ist die einzige integrierte vollwertige Programmiersprachen-Runtime und benötigt beim ersten Start eine Internetverbindung zu **jsDelivr/Pyodide**. Alle übrigen Kernfunktionen benötigen keine externen CDNs. Die Python-Ausführung hat bewusst **keinen Schreibzugriff auf das virtuelle JS-Dateisystem** (der Quelltext wird an den Worker übergeben). Durch „Stop Python“ kann ein festhängender Worker beendet werden. Für eine echte JVM, .NET oder serverseitiges PHP wäre ein Backend oder viel umfangreicheres WebAssembly-Bundle nötig, was GitHub Pages nicht von sich aus bereitstellt.

## Daten / Datenschutz

- Die Beispieldateien sind lokal im Code gebündelt; Veränderungen werden im `localStorage` des **jeweiligen** Browsers gespeichert.
- SQL-Lerndaten bleiben pro Betriebssystem getrennt im `localStorage`.
- Kein Login, keine Telemetrie und keine Backend-Datenübertragung. **Ausnahme:** Auf Abruf wird Pyodide vom CDN heruntergeladen.
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

**Windows 11:** `dir` → `type hello.py` → `powershell` → `Get-ChildItem` → `python hello.py`.

**Debian:** `pwd` → `ls -la` → `cat index.html` → `python3 -m http.server 8000` → Browser `http://localhost:8000`.

**Arch:** `uname -a` → `pacman -S python` (Demoinfo) → `ls` → `nano hello.py`.

**SQL:** `sqlite3 demo.db` → `SELECT * FROM schueler;` → `INSERT INTO schueler (name, klasse, punkte) VALUES ('Mira', '9b', 92);` → `SELECT * FROM schueler WHERE punkte >= 90 ORDER BY punkte DESC;` → `.exit`.

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

Dieser Test prüft alle neun Betriebssystemprofile, typische Befehle, Ordnererstellung, Terminal-SQL, simulierten localhost, SQL-Filter/CRUD, Sprach-Demos und lokale Persistenz.
