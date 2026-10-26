# Dotflash

Dotflash designs temporary tattoos in the browser and prints them over Bluetooth. It replaces the phone app that ships with the Hello Blink tattoo maker.

**[Open the editor](https://craigory.dev/dotflash/)**

## Compatibility

| Needs   | Supported                                                                               |
| ------- | --------------------------------------------------------------------------------------- |
| Printer | Hello Blink tattoo maker, advertising over Bluetooth as `WS-171C`                       |
| Browser | Chrome, Edge or Opera on desktop or Android. Safari, Firefox and iOS lack Web Bluetooth |
| Paper   | 50 × 69 mm transfer sheets. The printable area is 48 × 57 mm                            |

Close the printer's phone app before connecting. The printer stops advertising while the app holds it.

## Editor

The editor has two stages, like a 3D printer slicer.

- **Design** places artwork on the sheet. Add images by picker, drag-and-drop or paste, then drag, scale and rotate them. Artwork snaps to the printable edges, and a 3 × 3 grid aligns it to a corner, an edge or the centre. Hold Alt to place freely. Remove background runs [`@imgly/background-removal`](https://github.com/imgly/background-removal-js) on the device after a one-time model download.
- **Preview** shows the exact dots the printer will burn, mirrored as they land on paper. Shading, brightness, contrast and mirroring live here and update the dots as you adjust them. Print sends what Preview shows.

Press the printer's lid down while it prints, or the right edge comes out faint.

## CLI

The CLI drives the printer from a terminal over BLE. It has only been tested on macOS.

| Command                         | Purpose                                                      |
| ------------------------------- | ------------------------------------------------------------ |
| `bun cli status`                | Firmware, battery, head width, serial and paper state        |
| `bun cli scan [seconds]`        | List nearby BLE devices                                      |
| `bun cli feed [lines]`          | Advance the paper                                            |
| `bun cli print <image>`         | Print an image                                               |
| `bun cli pattern <name>`        | Print a test pattern: `ruler`, `ladder`, `corner` or `wedge` |
| `bun cli export-patterns [dir]` | Write the test patterns as PNGs                              |

The `print` command takes `--density light|medium|dark`, `--threshold`, `--no-mirror`, `--brightness n`, `--contrast n` and `--dry-run`. Prints are mirrored by default because transfers go on face down.

## Development

```sh
bun install
bun editor                                  # editor on localhost, with hot reload
bunx nx run-many -t typecheck test build    # what CI runs
```

| Project            | Contents                                                                            |
| ------------------ | ----------------------------------------------------------------------------------- |
| `packages/printer` | Protocol, raster encoding, image processing, test patterns, Web Bluetooth transport |
| `apps/editor`      | React and Konva editor. Builds to static files in `apps/editor/dist`                |
| `apps/cli`         | Terminal driver over noble                                                          |

Web Bluetooth needs a secure context, and `localhost` counts as one. Pushes to `main` deploy the editor to GitHub Pages.

## Protocol

The protocol comes from the vendor app (`com.yhk.rabbit.print`). It is ESC/POS-like and runs over Microchip's BLE Transparent UART service.

| UUID                                   | Role    |
| -------------------------------------- | ------- |
| `49535343-fe7d-4ae5-8fa9-9fafd205e455` | Service |
| `49535343-8841-43f4-a8d4-ecbe34729bb3` | Write   |
| `49535343-1e4d-4bd9-ba61-23c647249616` | Notify  |

| Bytes                          | Meaning                                                                                     |
| ------------------------------ | ------------------------------------------------------------------------------------------- |
| `1D 49 F0 nn`                  | Darkness. This model uses 20, 25 and 30                                                     |
| `1B 40`                        | Reset                                                                                       |
| `1D 76 30 00 wL wH hL hH data` | Raster image. `w` is bytes per row and `h` is rows. MSB is the leftmost dot, and 1 is black |
| `0A`                           | Line feed, about 3 mm. The only command that moves paper                                    |
| `1D 49 F8 n`                   | Copy count                                                                                  |
| `1E 47 03`                     | Status. Reply: `HV=H1.0,SV=V1.01,VOLT=7680mv,DPI=384,`                                      |
| `1D 67 69`                     | Product. Reply: `public id:0801.`                                                           |
| `1D 67 39`                     | Serial number. Reply: `sn:…`                                                                |
| `1D 67 53`                     | Paper state. `err:` followed by `00` means no error                                         |

A print job is darkness, reset, one raster command per row, then 20 line feeds to eject the sheet. The head is 384 dots wide at 8 dots per mm. Grayscale comes from Floyd–Steinberg dithering.

The vendor app hides some behaviour:

- Send one row per raster command. The printer advances about one row per command however many rows it holds, and it drops the tail of a tall command that outruns BLE.
- Write with response. Unacknowledged writes overflow the printer and it powers off.
- Query the status and wait for the reply before disconnecting, or the end of the job is lost.
- Printing starts 7.5 mm below the top edge of the sheet and covers 456 rows.

## License

[AGPL-3.0-or-later](LICENSE). The editor bundles `@imgly/background-removal`, which is also AGPL.
