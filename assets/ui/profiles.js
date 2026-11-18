// OS-spezifische Profile: Namen, Bedienkonzepte und Farbschemata.
export const PROFILES = {
  winxp: {
    family: 'windows', chrome: 'xp', controls: 'right', snap: false, menuBar: false,
    names: { terminal: 'Eingabeaufforderung', files: 'Windows-Explorer', editor: 'Editor', browser: 'Internet Explorer', settings: 'Systemsteuerung', taskmgr: 'Windows Task-Manager', calc: 'Rechner', trash: 'Papierkorb', computer: 'Arbeitsplatz', docs: 'Eigene Dateien', about: 'Info über Windows', ide: 'Code-Editor (IDE)' },
    terminalTheme: 'conhost-classic', font: 'Tahoma, "Segoe UI", Verdana, sans-serif',
    desktop: ['computer', 'docs', 'trash', 'browser', 'terminal', 'ide', 'git', 'structogram', 'game', 'sql', 'fun', 'guide'],
    pinned: ['browser', 'terminal', 'files']
  },
  win7: {
    family: 'windows', chrome: 'aero', controls: 'right', snap: true,
    names: { terminal: 'Eingabeaufforderung', files: 'Windows-Explorer', editor: 'Editor', browser: 'Internet Explorer', settings: 'Systemsteuerung', taskmgr: 'Windows Task-Manager', calc: 'Rechner', trash: 'Papierkorb', computer: 'Computer', docs: 'Dokumente', about: 'Info über Windows', ide: 'Code-Editor (IDE)' },
    terminalTheme: 'conhost-classic', font: '"Segoe UI", Tahoma, sans-serif',
    desktop: ['computer', 'trash', 'docs', 'terminal', 'ide', 'git', 'structogram', 'game', 'sql', 'fun', 'guide'],
    pinned: ['browser', 'files', 'terminal', 'ide']
  },
  win8: {
    family: 'windows', chrome: 'metro', controls: 'right', snap: true,
    names: { terminal: 'Eingabeaufforderung', files: 'Explorer', editor: 'Editor', browser: 'Internet Explorer', settings: 'Systemsteuerung', taskmgr: 'Task-Manager', calc: 'Rechner', trash: 'Papierkorb', computer: 'Dieser PC', docs: 'Dokumente', about: 'Info über Windows', ide: 'Code-Editor (IDE)' },
    terminalTheme: 'conhost-classic', font: '"Segoe UI", Tahoma, sans-serif',
    desktop: ['computer', 'trash', 'terminal', 'ide', 'git', 'structogram', 'game', 'sql', 'fun', 'guide'],
    pinned: ['browser', 'files', 'terminal']
  },
  win10: {
    family: 'windows', chrome: 'win10', controls: 'right', snap: true,
    names: { terminal: 'Eingabeaufforderung', files: 'Datei-Explorer', editor: 'Editor', browser: 'Microsoft Edge', settings: 'Einstellungen', taskmgr: 'Task-Manager', calc: 'Rechner', trash: 'Papierkorb', computer: 'Dieser PC', docs: 'Dokumente', about: 'Info über Windows', ide: 'Visual Studio Code' },
    terminalTheme: 'conhost', font: '"Segoe UI", system-ui, sans-serif',
    desktop: ['trash', 'computer', 'terminal', 'ide', 'git', 'structogram', 'game', 'sql', 'fun', 'guide'],
    pinned: ['files', 'browser', 'terminal', 'ide', 'settings']
  },
  win11: {
    family: 'windows', chrome: 'win11', controls: 'right', snap: true,
    names: { terminal: 'Terminal', files: 'Explorer', editor: 'Editor', browser: 'Microsoft Edge', settings: 'Einstellungen', taskmgr: 'Task-Manager', calc: 'Rechner', trash: 'Papierkorb', computer: 'Dieser PC', docs: 'Dokumente', about: 'Info über Windows', ide: 'Visual Studio Code' },
    terminalTheme: 'windows-terminal', font: '"Segoe UI Variable", "Segoe UI", system-ui, sans-serif',
    desktop: ['trash', 'terminal', 'ide', 'git', 'structogram', 'game', 'sql', 'fun', 'guide'],
    pinned: ['files', 'browser', 'terminal', 'ide', 'settings', 'game']
  },
  debian: {
    family: 'gnome', chrome: 'adwaita', controls: 'close-only', snap: true,
    names: { terminal: 'Terminal', files: 'Dateien', editor: 'Texteditor', browser: 'Firefox', settings: 'Einstellungen', taskmgr: 'Systemüberwachung', calc: 'Taschenrechner', trash: 'Papierkorb', computer: 'Persönlicher Ordner', docs: 'Dokumente', about: 'Info', ide: 'Visual Studio Code' },
    terminalTheme: 'gnome', font: 'Cantarell, "Adwaita Sans", "Noto Sans", Inter, system-ui, sans-serif',
    desktop: [],
    pinned: ['browser', 'files', 'terminal', 'editor', 'ide', 'settings', 'game']
  },
  arch: {
    family: 'kde', chrome: 'breeze', controls: 'right', snap: true,
    names: { terminal: 'Konsole', files: 'Dolphin', editor: 'Kate', browser: 'Firefox', settings: 'Systemeinstellungen', taskmgr: 'Systemmonitor', calc: 'KCalc', trash: 'Papierkorb', computer: 'Persönlicher Ordner', docs: 'Dokumente', about: 'Infozentrum', ide: 'Visual Studio Code' },
    terminalTheme: 'breeze', font: '"Noto Sans", "Segoe UI", system-ui, sans-serif',
    desktop: ['home', 'trash'],
    pinned: ['files', 'browser', 'terminal', 'ide']
  },
  macos: {
    family: 'mac', chrome: 'aqua', controls: 'left', snap: false, menuBar: true,
    names: { terminal: 'Terminal', files: 'Finder', editor: 'TextEdit', browser: 'Safari', settings: 'Systemeinstellungen', taskmgr: 'Aktivitätsanzeige', calc: 'Rechner', trash: 'Papierkorb', computer: 'Macintosh HD', docs: 'Dokumente', about: 'Über diesen Mac', ide: 'Visual Studio Code' },
    terminalTheme: 'mac-basic', font: '-apple-system, "SF Pro Text", "Helvetica Neue", Inter, system-ui, sans-serif',
    desktop: [],
    pinned: ['files', 'browser', 'terminal', 'editor', 'ide', 'calc', 'settings', 'game', 'git', 'sql']
  },
  unix: {
    family: 'cde', chrome: 'motif', controls: 'cde', snap: false,
    names: { terminal: 'Terminal', files: 'Dateimanager', editor: 'Texteditor', browser: 'Webbrowser', settings: 'Stilmanager', taskmgr: 'Prozessmanager', calc: 'Rechner', trash: 'Papierkorb', computer: 'Home', docs: 'Dokumente', about: 'Über CDE', ide: 'Code-Editor (IDE)' },
    terminalTheme: 'dtterm', font: '"Helvetica Neue", Helvetica, Arial, sans-serif',
    desktop: [],
    pinned: ['files', 'editor', 'terminal', 'browser', 'settings']
  }
};
export const profileFor = id => PROFILES[id] || PROFILES.win11;

// ANSI-Paletten je Terminalprogramm (Index 0–15) und Grundfarben.
export const TERMINAL_THEMES = {
  'conhost-classic': { bg: '#000000', fg: '#c0c0c0', font: '"Lucida Console", Consolas, "Courier New", monospace', size: 14, palette: ['#000000', '#800000', '#008000', '#808000', '#000080', '#800080', '#008080', '#c0c0c0', '#808080', '#ff0000', '#00ff00', '#ffff00', '#0000ff', '#ff00ff', '#00ffff', '#ffffff'], cursor: 'underline' },
  conhost: { bg: '#0c0c0c', fg: '#cccccc', font: 'Consolas, "Cascadia Mono", "Courier New", monospace', size: 15, palette: ['#0c0c0c', '#c50f1f', '#13a10e', '#c19c00', '#0037da', '#881798', '#3a96dd', '#cccccc', '#767676', '#e74856', '#16c60c', '#f9f1a5', '#3b78ff', '#b4009e', '#61d6d6', '#f2f2f2'], cursor: 'underline', psBg: '#012456', psFg: '#eeedf0' },
  'windows-terminal': { bg: '#0c0c0c', fg: '#cccccc', font: '"Cascadia Mono", "Cascadia Code", Consolas, monospace', size: 14, palette: ['#0c0c0c', '#c50f1f', '#13a10e', '#c19c00', '#0037da', '#881798', '#3a96dd', '#cccccc', '#767676', '#e74856', '#16c60c', '#f9f1a5', '#3b78ff', '#b4009e', '#61d6d6', '#f2f2f2'], cursor: 'bar' },
  gnome: { bg: '#1e1e1e', fg: '#ffffff', font: '"Adwaita Mono", "DejaVu Sans Mono", "Noto Mono", Menlo, monospace', size: 14, palette: ['#241f31', '#c01c28', '#2ec27e', '#f5c211', '#1e78e4', '#9841bb', '#0ab9dc', '#c0bfbc', '#5e5c64', '#ed333b', '#57e389', '#f8e45c', '#51a1ff', '#c061cb', '#4fd2fd', '#f6f5f4'], cursor: 'block', boldBright: true },
  breeze: { bg: '#232627', fg: '#fcfcfc', font: '"Hack", "DejaVu Sans Mono", "Noto Mono", monospace', size: 14, palette: ['#232627', '#ed1515', '#11d116', '#f67400', '#1d99f3', '#9b59b6', '#1abc9c', '#fcfcfc', '#7f8c8d', '#c0392b', '#1cdc9a', '#fdbc4b', '#3daee9', '#8e44ad', '#16a085', '#ffffff'], cursor: 'block', boldBright: true },
  'mac-basic': { bg: '#ffffff', fg: '#000000', font: '"SF Mono", Menlo, Monaco, "Courier New", monospace', size: 13, palette: ['#000000', '#990000', '#00a600', '#999900', '#0000b2', '#b200b2', '#00a6b2', '#bfbfbf', '#666666', '#e50000', '#00d900', '#e5e500', '#0000ff', '#e500e5', '#00e5e5', '#e5e5e5'], cursor: 'block' },
  dtterm: { bg: '#ffffff', fg: '#000000', font: '"Courier New", Courier, monospace', size: 14, palette: ['#000000', '#cd0000', '#00cd00', '#cdcd00', '#0000ee', '#cd00cd', '#00cdcd', '#e5e5e5', '#7f7f7f', '#ff0000', '#00ff00', '#ffff00', '#5c5cff', '#ff00ff', '#00ffff', '#ffffff'], cursor: 'block' }
};
