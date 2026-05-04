# YunYunEditor

[Editor Link](https://ebro912.github.io/YunYunEditor/)

A web-based visual chart editor for [YunYunLoader](https://github.com/EBro912/YunYunLoader/) mods. Runs entirely in the browser; no ads, no accounts, completely free. Your changes are automatically saved locally, and you can save up to 20 drafts of songs you're working on. When finished, easily export your progress to a YunYunLoader ready mod in a single click!

*Disclaimer: This project contains AI-generated code.*

## Usage

1. Click the 'New' button to start a new song, or drag and drop a YunYunLoader mod `.zip` anywhere in the window or click **Import .zip** to start from an existing mod.
2. To swap the audio track, click **Import audio** (or drop a `.ogg` file anywhere). The filename in `song.json`'s `Audio` field is updated automatically.
3. Click the '+ Level' button to add a new level to your song. 
4. Select a tool from **Tools** section and click on the track to add notes to the song. You can select and drag existing notes around by clicking on them once placed. You can also add events such as BGM changes, Time Signature changes, and Phase changes using the **Events** section.
5. Save your progress as a draft in the **Drafts** panel. You can then come back later and load a draft to resume your work.
6. **Export** automatically creates a YunYunLoader-ready ZIP file, ready to extract into the `Songs/` directory.

### Shortcuts

| Key                              | Action                       |
|----------------------------------|------------------------------|
| `Space`                          | Play / pause                 |
| `Home` / `End`                   | Seek to start / end          |
| `1` / `2` / `3` / `4`            | Single / Hold / Rush / Eraser|
| `V`                              | Select                       |
| `S`                              | Toggle snap                  |
| `[` / `]`                        | Halve / double snap division |
| `Ctrl+Z` / `Ctrl+Shift+Z`        | Undo / redo                  |
| `Ctrl+S`                         | Force autosave               |
| `Ctrl+E`                         | Open Export dialog           |
| `Ctrl+O`                         | Import .zip                  |
| `Delete`                         | Remove selected notes        |
| `,` / `.`                        | Nudge selection by snap unit |
| `<` / `>`                        | Nudge selection by a beat    |


## Running Locally

The editor can be run locally by following these steps: 

1. Clone the repository.
2. Install `npm` and `nodejs` if you have not already.
3. 
```bash
npm install
npm run dev      # run a dev build on http://localhost:5173
npm run build    # builds static files in ./dist/
npm run preview  # run a preview build on http://localhost:4173
```

## Issues
If you run into an issue using the editor, feel free to open an issue in the **Issues** tab. Make sure to be as detailed as possible in your report; include the steps you took to reproduce the error, any relevant log output or errors, as well as screenshots and/or videos of the issue occuring. Check the issues tab before creating a new one to see if another user has already reported your issue.

## Contributing
If you would like to contribute to the editor, simply clone the repository, make your changes, and open a **Pull Request** explaining your changes and why the change is necessary. Make sure to follow the steps from the **Running Locally** section in order to set up your development environment after cloning.
