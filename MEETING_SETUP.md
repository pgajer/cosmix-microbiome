# Get CoSMiX and choose your datasets

CoSMiX is developing quickly. Install the software once from GitHub; keep your
separately supplied data in place so later software updates are one command.
Data are not downloaded from GitHub or uploaded by setup.

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
Do not disable macOS security protections.

New installations use `~/cosmix` for the app. The recommended data folder is
`~/cosmix-data`. If you already use `~/vme` and `~/vme-data`, keep using those
folders in the instructions below. The usual update command finds your existing
app and remembers its data paths. If both app folders contain separate installations,
choose one with `--output ~/cosmix` or `--output ~/vme`. After an intentional move,
a direct link from `~/vme` to `~/cosmix` works for launchers and updates.
Backups are named after the actual app folder.

## 1. Download just the data you need

From the team's shared CoSMiX release folder, download **VME-starter.zip** and one
or more dataset ZIPs listed in **DATASETS.md**. Keep the ZIPs from the same release
together in a folder, for example `~/Downloads/VME-downloads`.

The starter contains the catalogue and local server; each dataset ZIP contains
its own saved samples, annotations, embeddings and available analysis results.
Li/Lc neighborhoods are not included. The two HMP+U01 packages are distinct
releases, not an upgrade pair. PAPCLEAR remains explicitly provisional.

Extract them into the same location. The following commands avoid Finder's
similarly named duplicate folders; run them after downloading the chosen ZIPs:

```sh
mkdir -p "$HOME/cosmix-data"
for archive in "$HOME/Downloads/VME-downloads/"*.zip; do
  ditto -x -k "$archive" "$HOME/cosmix-data"
done
```

This creates `~/cosmix-data/VME-meeting-2026-11-02`, containing `catalog.json`,
`common`, and the dataset folders you downloaded. Keep this folder in place.
Use only ZIPs from the supplied release; the installer checks file identities
and rejects missing, mismatched or damaged data. Data retain their own access
and reuse terms and are excluded from CoSMiX's MIT software license.

## 2. Get the software and choose datasets

If this is your first installation:

```sh
git clone https://github.com/pgajer/cosmix-microbiome.git "$HOME/cosmix-source"
cd "$HOME/cosmix-source"
```

If you already have a clone, use its existing folder for this and later commands. For example, use `~/vme-source` wherever this guide shows `~/cosmix-source` if that is where you originally cloned it.

```sh
cd "$HOME/cosmix-source"
git pull --ff-only
```

Install the app and select your datasets from the numbered list:

```sh
python3 scripts/portable.py update \
  --catalog "$HOME/cosmix-data/VME-meeting-2026-11-02" \
  --select-datasets
```

Enter numbers separated by spaces, for example `3 7 8`, or `all` if you downloaded
all dataset ZIPs. Read the displayed names rather than relying on the example
numbers. The app is created at `~/cosmix`. The source stays in `~/cosmix-source`.
A previous CoSMiX app is preserved in a backup folder printed by the installer.

## 3. Open CoSMiX

Double-click **Start CoSMiX.command** in `~/cosmix`. Keep its Terminal window open.
Your browser opens at **http://127.0.0.1:43818/**. This is a server on your own
computer, not an Internet service. Choose a dataset from the Dataset menu;
**Empty** shows the interface without data.

The app uses local data and works offline after installation. Some views take
time to load; allow the loading message to finish. Use a desktop computer with
several GiB of free memory and disk space. Download sizes and unpacked sizes are
listed in DATASETS.md. Allow space for extracted data, the app, and update backups.
The installer can share immutable asset storage on the same filesystem, but do
not rely on this to eliminate all extra storage.

## Update the software

Stop CoSMiX with **Control-C** in its Terminal, then run:

```sh
cd "$HOME/cosmix-source"
git pull --ff-only && python3 scripts/portable.py update
```

Existing clones of the former `pgajer/vme` repository can use this same update command. The original `Start VME.command` launcher also works.

Reopen `~/cosmix/Start CoSMiX.command` and reload your browser tab. Your dataset
selection and data location are remembered. This command does not run models or
the optional integration/layout tests. A failed update keeps the previous app.
Backups are retained, not automatically deleted.

## Add or change datasets

Download any additional dataset ZIPs from the **same release** and extract them
into `~/cosmix-data` as above. Stop CoSMiX, then run:

```sh
cd "$HOME/cosmix-source"
python3 scripts/portable.py update --select-datasets
```

Select the **complete set** you now want installed. Deselecting a dataset removes
it only from the new app; its original data and the previous app are preserved.
For a newer data release, keep its separate versioned folder and repeat setup
with its new `--catalog` path. Software updates alone do not fetch new data.

## If something does not work

- **Missing dataset ZIP:** download the named file and extract it into the same
  release folder as the starter.
- **Checksum or revision mismatch:** obtain matching files again; do not edit
  checksums or bypass validation.
- **Port already in use:** stop the other CoSMiX launcher before installing/starting.
- **Blank/loading browser:** reload the page; check the launcher's Terminal for
  errors and confirm you opened port 43818. Send Pawel the exact error and browser.
- **Existing directory is not a CoSMiX app:** preserve it; choose another output path
  using `--output /path/to/new/app`. Do not overwrite a source clone with the app.

Available analyses depend on the dataset. In-app Methods/PDF buttons carry the
included analysis documentation. The separate development report dashboard,
mutual-overlap research browser and optional live R services are not included.
Existing scientific limitations remain visible; these packages reuse saved
results rather than constituting a new scientific analysis or approval.
