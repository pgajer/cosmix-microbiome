# Get MiCOVE and your datasets

MiCOVE is developing quickly. Install the software once from GitHub, then keep
it current with the update command below.

**All MiCOVE dataset packages and metadata supplements are obtained directly
from Pawel Gajer, on an individual basis.** Contact Pawel to arrange the datasets
you want to explore—your own data or public datasets already prepared for MiCOVE.
He will provide the appropriate files and any dataset-specific setup steps.
There is no general shared-folder download. GitHub contains the software source;
installation and software updates do not download or upload research data.

These instructions are for **macOS 11 or later** (Apple Silicon or Intel), with
Git, Python 3.9 or later, and a browser that supports WebGL. No R, scientific
packages or model fitting is needed. Windows/Linux installation is not part of
this release. First check in Terminal:

```sh
git --version
python3 --version
```

If either command is missing, install it using your institution's supported
software route before proceeding. A Mac may ask for approval to open a downloaded
launcher or executable; follow your institution's normal approval procedure.

New installations use `~/micove-source` for the source clone, `~/micove` for the
app, and `~/micove-data` for separately supplied data. Existing CoSMiX or VME installations
can keep their current folders, launchers and update command; substitute your
actual source folder wherever this guide shows `~/micove-source`.

## 1. Obtain and unpack your data

Ask Pawel for the datasets you need. Package contents vary by project. Follow
the instructions supplied with your files; do not rename files inside a package.

For a **catalogue release**, Pawel supplies **MiCOVE-starter.zip** and the dataset
ZIPs agreed with you. The accompanying **DATASETS.md** lists the available files
and their sizes. Keep matching ZIPs together in a dedicated folder, for example
`~/Downloads/MiCOVE-downloads`. Extract them into the same location:

```sh
mkdir -p "$HOME/micove-data"
for archive in "$HOME/Downloads/MiCOVE-downloads/"*.zip; do
  ditto -x -k "$archive" "$HOME/micove-data"
done
```

The extracted release folder contains `catalog.json`, `common`, and your dataset
folders. In the commands below, **MiCOVE-release is an example folder name**;
replace it with the actual release folder supplied by Pawel. Keep that folder
in place so later updates can find your data. Earlier packages may have different
names and remain supported; keep their names and use their supplied paths.

Some datasets, including standalone AGP or skin packages, have additional
installation steps. Use the command supplied with that package; the catalogue
command below does not apply to every package format. [Advanced setup](PORTABLE.md)
describes the supported alternatives.

Data retain their own access and reuse terms and are excluded from MiCOVE's MIT
software license.

## 2. Get the software and select datasets

For a first installation:

```sh
git clone https://github.com/pgajer/micove-microbiome.git "$HOME/micove-source"
cd "$HOME/micove-source"
```

If you already have a clone, enter its existing folder and update it:

```sh
cd "$HOME/micove-source"
git pull --ff-only
```

For a catalogue release, install the app and choose your datasets from the
numbered list. Replace `MiCOVE-release` with your actual release folder:

```sh
python3 scripts/portable.py update \
  --catalog "$HOME/micove-data/MiCOVE-release" \
  --select-datasets
```

Enter numbers separated by spaces, or `all` only if you have every dataset ZIP
listed in that catalogue. Select only the datasets supplied to you. Different
people can install different subsets. The app is created at `~/micove`, separate
from the source and original data. A previous app is preserved in a backup folder
printed by the installer.

## 3. Open MiCOVE

Double-click **Start MiCOVE.command** in `~/micove`. Keep its Terminal window open.
Your browser opens at **http://127.0.0.1:43818/**. This server runs on your own
computer. Choose a dataset from the Dataset menu; **Empty** shows the interface
without data.

The app works offline after installation. Some views take time to load. Allow
space for the extracted data, the app and update backups; package sizes are
provided with your data. The installer can share immutable asset storage on
the same filesystem, but do not rely on this to eliminate all extra storage.

## Update the software

Stop MiCOVE with **Control-C** in its Terminal, then run:

```sh
cd "$HOME/micove-source"
git pull --ff-only && python3 scripts/portable.py update
```

Reopen **Start MiCOVE.command** and reload your browser tab. Your dataset selection
and data paths are remembered. Keep the original packages and supplements in
place. Older clone folders and launchers still work; no folder rename is needed.
This command does not run models or the optional integration/layout tests.
A failed update keeps the previous app. Backups are not automatically deleted.

## Add or update datasets

Contact Pawel directly for another dataset, a data revision, or a supplement.
Software updates alone do not fetch new data. Use the matching files and paths
he supplies; keep new data releases in separate versioned folders.

For additional dataset ZIPs from the **same catalogue release**, extract them
as above, stop MiCOVE, then run:

```sh
cd "$HOME/micove-source"
python3 scripts/portable.py update --select-datasets
```

Select the **complete set** you now want installed. Deselecting a dataset removes
it only from the new app; the original data and previous app are preserved.
For a newer catalogue release, repeat setup with its new `--catalog` path.

## If something does not work

- **Missing dataset or supplement:** contact Pawel for the matching files.
- **Checksum or revision mismatch:** obtain matching files again; do not edit
  checksums or bypass validation.
- **Port already in use:** stop the other MiCOVE launcher before installing/starting.
- **Blank/loading browser:** reload the page and check the launcher's Terminal.
  Send Pawel the exact error, browser and package name.
- **Existing directory is not a MiCOVE app:** preserve it and choose another output
  path with `--output /path/to/new/app`. Do not overwrite a source clone with the app.

Available views and analyses depend on your dataset package. In-app Methods/PDF
buttons provide its included analysis documentation. Packages reuse saved
results and retain their stated scientific limitations.
