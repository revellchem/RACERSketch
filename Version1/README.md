# RACER Sketch – Version 1

A dependency-free organic-structure editor in three files. Open `index.html` in Chrome, Edge, or Firefox.
It also works from a web server or an LMS page; nothing is installed and nothing is sent anywhere.

```
index.html     page shell (top bar, tool rail, canvas, status bar, dialogs)
sketcher.css   layout and theme
sketcher.js    the editor: model, tools, SVG renderer, exporters, molfile reader/writer
```

## Tools (left rail, with keyboard shortcut)

| Tool | Key | What it does |
|---|---|---|
| Select / lasso | V | Click an item to select it; drag on empty space to lasso (a straight drag acts as a rectangle). Drag selected items to move them. Shift+click adds to the selection. Drag the round handles at the ends of an arrow to resize or rotate it. Double-click text to edit it. |
| Bond | B | Click empty space: new C–C bond at 30°. Click an atom: add a bond (120° spacing, 4th bond in the largest gap). Drag from an atom: bond in that direction (snaps to 15°; drops onto an existing atom to close a ring). Click a bond: single → double → triple → single. A triple bond straightens the atoms to 180°; cycling back restores them. |
| Atom label | X | Opens a palette of C H N O F Cl Br I P S plus the full periodic table. Click an atom to relabel it, or click empty space to place a lone atom (H₂O, NH₃, HBr …). Hydrogens are added automatically. Labelling a carbon as C shows it with its hydrogens (CH₃); pressing C again hides the label. |
| Wedge / dash | W | Click a bond once for a wedge, again for a hashed (dash) bond, again to clear. The narrow end goes at the atom with more bonds (the stereocentre); if both ends are equal, at the end nearer the click. A stereocentre may carry one wedge and one dash: if it already has a wedge, other bonds cycle flat → dash only (and vice versa). Click or drag from an atom to add a new wedged bond. Saved in the .mol stereo field (1 = wedge, 6 = dash). |
| 5-ring / 6-ring | 5 / 6 | Click empty space to place a ring, click a bond to fuse a ring to it, or click an atom to attach a ring at that atom. |
| Benzene | A | Same placement as the 6-ring, with alternating double bonds (Kekulé form). Fusing onto benzene gives naphthalene with a correct alternation; clicking a chain-end carbon makes it a phenyl group. |
| Reaction arrow | R | Click to place, or drag to set length and direction. |
| Equilibrium arrow | Q | Same as above, with harpoon heads. |
| Text | T | Click to place text, Enter to finish. Digits after letters become subscripts (H2SO4 → H₂SO₄); `^` starts a superscript (`^+`). |
| Eraser | E | Click or drag across atoms, bonds, arrows, or text. |

## Keyboard shortcuts on the canvas

- Hover an atom (a blue halo appears) and press **C H N O F L B I P S** to relabel it (L = Cl, B = Br). Works in every tool.
- Hover a bond and press **1 2 3** to set its order.
- **Delete** removes the hovered item, or the selection.
- **Ctrl+Z / Ctrl+Y** undo / redo, **Ctrl+C / Ctrl+V / Ctrl+X** copy / paste / cut, **Ctrl+A** select all, **Esc** back to Select.

## Top bar

- **Undo / Redo / Clear**.
- **Open .mol** – opens a V2000 molfile (you can also drop a .mol file on the canvas). Replaces the drawing; Undo brings the old one back.
- **Analyze** – molecular formula (Hill order, implicit hydrogens included) and molar mass of the selected atoms, or of everything if nothing is selected. "Add to drawing" places the result as text under the structure; "Copy text" copies it.
- **Copy image** – copies a 2× PNG with a white background to the clipboard (Chrome and Edge; other browsers download the PNG instead).
- **Save PNG / JPG** – downloads the image, cropped to the drawing. The format is chosen in Options.
- **Save .mol** – downloads a V2000 molfile. Arrows and text are not part of the molfile format, so they appear in images only.
- **⚙ Options** – heteroatom labels in colour or black only; image format. Options are remembered in the browser.

## Drawing conventions

- Bond length 44 px, line width 2 px, Arial 20 px labels. These live in the `S` object at the top of `sketcher.js` and will become the settings menu.
- Carbons are bare vertices; heteroatoms show their symbol plus hydrogens (OH, NH₂). Hydrogens go on the side away from the bonds, or above/below for ring NH.
- Double bonds in rings draw the second line inside the ring; when a double bond is shared by two rings (tetralin, indane) the inner line goes in the ring with more double bonds. Terminal double bonds to a labelled atom (C=O) are drawn symmetrically.
- An atom can have at most 6 bonds; the status bar says so if a click would exceed that.

## Embedding API (for the future graded widget)

`sketcher.js` exposes `window.RACERSketch`:

```js
RACERSketch.getMol()      // current drawing as a V2000 molfile string
RACERSketch.setMol(text)  // replace the drawing with a molfile
RACERSketch.clear()
RACERSketch.getModel()    // plain-data copy of atoms, bonds, annotations
RACERSketch.settings      // the live settings object
```

## Not yet implemented

Charges and radicals, SMILES export, V3000 molfiles, and the font / bond-width settings menu.
