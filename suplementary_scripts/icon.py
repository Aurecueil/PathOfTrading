import os
from pathlib import Path
from PIL import Image

# ==========================================
# CONFIGURATION - Set your file paths here
# ==========================================
SOURCE_PNG_PATH = r"favicon.png"        # Path to your source PNG
ICONS_DIR_PATH = r"src-tauri\icons"     # Path to Tauri icons directory
# ==========================================


def replace_icons(source_path: str, icons_dir: str) -> None:
    source_file = Path(source_path).resolve()
    icons_dir = Path(icons_dir).resolve()

    if not source_file.exists():
        raise FileNotFoundError(f"Source image not found at: {source_file}")

    if not icons_dir.is_dir():
        raise FileNotFoundError(f"Icons directory not found at: {icons_dir}")

    # Open the source PNG image
    source_img = Image.open(source_file)
    if source_img.mode != "RGBA":
        source_img = source_img.convert("RGBA")

    print(f"Loaded source image: {source_file.name} ({source_img.size[0]}x{source_img.size[1]}px)\n")

    # Iterate over all files in the icons folder
    for file_path in icons_dir.iterdir():
        # Skip directories and the source file itself
        if file_path.is_dir() or file_path.resolve() == source_file:
            continue

        file_extension = file_path.suffix.lower()

        try:
            # Read existing file metadata
            with Image.open(file_path) as target_img:
                width, height = target_img.size
                format_type = target_img.format
                mode = target_img.mode
                info_metadata = target_img.info.copy()

            print(f"Processing: {file_path.name}")
            print(f"  ├─ Metadata read: size=({width}x{height}), format={format_type}, mode={mode}")

            # Resize source image matching target dimensions (LANCZOS resampling)
            resized_img = source_img.resize((width, height), Image.Resampling.LANCZOS)

            # Preserve mode if needed
            if mode in ("RGB", "L", "1", "CMYK", "P"):
                resized_img = resized_img.convert(mode)

            # Save according to target format extension
            if file_extension == ".ico":
                # For .ico files, embed multi-resolution icons up to target width/height
                sizes = [(16, 16), (24, 24), (32, 32), (48, 48), (64, 64), (128, 128), (256, 256)]
                valid_sizes = [s for s in sizes if s[0] <= width and s[1] <= height]
                if (width, height) not in valid_sizes:
                    valid_sizes.append((width, height))
                resized_img.save(file_path, format="ICO", sizes=valid_sizes)

            elif file_extension == ".icns":
                resized_img.save(file_path, format="ICNS")

            elif file_extension == ".png":
                # Preserve PNG metadata info dict if present
                resized_img.save(file_path, format="PNG", **info_metadata)

            else:
                # Fallback for any other file extensions based on detected format
                fmt = format_type if format_type else file_extension.strip(".").upper()
                resized_img.save(file_path, format=fmt)

            print(f"  └─ Replaced successfully.\n")

        except Exception as err:
            print(f"  └─ Skipped ({file_path.name}): Not a valid image or failed to process ({err})\n")


if __name__ == "__main__":
    replace_icons(SOURCE_PNG_PATH, ICONS_DIR_PATH)