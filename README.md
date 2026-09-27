# Essentials Stream Tool

[![Release](https://img.shields.io/github/v/release/MellowB1/EST-EssentialsStreamTool)](https://github.com/MellowB1/EST-EssentialsStreamTool/releases/latest)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

Desktop overlays for **Pokémon Essentials** fangames — party, badges and lives, ready for OBS.

This repository distributes the compiled **Windows** build. Source code is not published here.

---

## Español

**Essentials Stream Tool (EST)** es una aplicación de escritorio portable para streamers que juegan fangames de Pokémon creados con **RPG Maker XP + Pokémon Essentials**. Lee el estado del juego en tiempo real y lo muestra en overlays HTML compatibles con **OBS**, Streamlabs u otras fuentes de navegador.

App **gratuita**, sin ánimo de lucro, hecha para la comunidad fangame.

### Características

- Biblioteca de fangames con detección automática de versión
- Tracking en tiempo real del equipo, HP, medallas y vidas
- Overlays OBS-friendly (estilo BW2): fondo transparente y sin parpadeos
- Presets de equipo (horizontal, vertical, rejilla, escalera, círculo; con o sin fondo de tipo)
- Overlays de medallas y de vidas / corazones
- PC en vivo y estadísticas de sesión en la GUI
- Permalocke visual (solo overlay) y opción para Pokémon Añil Permalocke
- Discord Rich Presence (opcional)
- Interfaz en español e inglés, tema claro / oscuro
- Compatible con **Essentials v16+** y forks BES (por ejemplo Pokémon Resplandor). v15 y anteriores quedan fuera de alcance

### Cómo usar

1. Descarga el ZIP de la [última release](https://github.com/MellowB1/EST-EssentialsStreamTool/releases/latest) y extráelo.
2. Abre `Essentials Stream Tool beta v0.0.2.exe`.
3. En **Biblioteca → Añadir juego**, elige la carpeta raíz del fangame (donde está `Game.ini`).
4. Pulsa **Jugar** y carga una partida. El estado debe pasar a *tracking en tiempo real*.
5. En **Overlays** (Equipo / Medallas / Corazones), elige un preset y pulsa **Copiar URL**.
6. En OBS: **Fuentes → Navegador → Archivo local** y pega esa ruta. Canvas 1920×1080, fondo transparente.
7. Coloca la fuente encima del capturador del juego. Varios overlays = varias fuentes Navegador.

**EST debe quedarse abierta mientras streameas.** Si la cierras, OBS deja de actualizar.

La app abre un WebSocket local (puerto `8585` por defecto) y sirve sprites por HTTP local (`8586`). No hace falta internet ni abrir puertos en el router. Si `8585` está ocupado, cámbialo en Configuración.

### Requisitos

- Windows
- Un fangame de Pokémon Essentials (carpeta con `Game.ini`)
- OBS u otro programa con fuente de navegador / archivo HTML local
- Discord Desktop (opcional, solo si activas Rich Presence)

### Créditos y agradecimientos

Creada por **MellowB1**.

Agradecimientos: **Bluriskayo · Dpertierra · Miolthor · Skyflyer_R · Zik**.

La idea nace a partir de [Pokemon Stream Tool](https://github.com/Readek/Pokemon-Stream-Tool) de **Readek**: overlays para OBS controlados por una GUI. EST aplica esa idea a fangames de Pokémon Essentials.

Hecha con cariño para la comunidad fangame.

### Licencia

MIT. Pokémon y Pokémon Essentials son de sus respectivos dueños. Este proyecto no está afiliado a Nintendo, Game Freak, The Pokémon Company ni a los autores de Pokémon Essentials.

---

## English

**Essentials Stream Tool (EST)** is a portable desktop app for streamers who play Pokémon fangames built with **RPG Maker XP + Pokémon Essentials**. It reads live game state and feeds HTML overlays compatible with **OBS**, Streamlabs, or any browser source.

A **free** app with no profit motive, made for the fangame community.

### Features

- Fangame library with automatic version detection
- Live tracking of party, HP, badges, and lives
- OBS-friendly overlays (BW2 look): transparent background, no flicker
- Party presets (horizontal, vertical, grid, stair, circle; with or without type chrome)
- Badge and lives / hearts overlays
- Live PC view and session stats in the GUI
- Visual Permalocke (overlay only) and a Pokémon Añil Permalocke option
- Optional Discord Rich Presence
- Spanish / English UI and light / dark theme
- Supports **Essentials v16+** and BES forks (e.g. Pokémon Resplandor). v15 and earlier are out of scope

### How to use

1. Download the ZIP from the [latest release](https://github.com/MellowB1/EST-EssentialsStreamTool/releases/latest) and extract it.
2. Open `Essentials Stream Tool beta v0.0.2.exe`.
3. In **Library → Add game**, pick the fangame root folder (the one with `Game.ini`).
4. Click **Play** and load a save. Status should switch to *live tracking*.
5. Under **Overlays** (Party / Badges / Hearts), pick a preset and **Copy URL**.
6. In OBS: **Sources → Browser → Local file** and paste that path. Use your canvas size (e.g. 1920×1080) and a transparent background.
7. Place the source above your game capture. Multiple overlays = multiple Browser sources.

**Keep EST open while you stream.** If you close it, OBS stops updating.

The app opens a local WebSocket (default port `8585`) and serves sprites over local HTTP (`8586`). No internet or router ports required. Change the port in Settings if `8585` is already in use.

### Requirements

- Windows
- A Pokémon Essentials fangame (folder with `Game.ini`)
- OBS or another program with a browser / local HTML source
- Discord Desktop (optional, only if you enable Rich Presence)

### Credits and acknowledgements

Created by **MellowB1**.

Thanks: **Bluriskayo · Dpertierra · Miolthor · Skyflyer_R · Zik**.

The idea comes from [Pokemon Stream Tool](https://github.com/Readek/Pokemon-Stream-Tool) by **Readek**: OBS overlays driven by a GUI. EST applies that idea to Pokémon Essentials fangames.

Made with care for the fangame community.

### License

MIT. Pokémon and Pokémon Essentials belong to their respective owners. This project is not affiliated with Nintendo, Game Freak, The Pokémon Company, or the authors of Pokémon Essentials.
