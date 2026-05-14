import os
import json

ICONS_DIR = os.path.join(os.path.dirname(__file__), "icons")
REGISTRY_PATH = os.path.join(ICONS_DIR, "registry.json")

def main():
    if not os.path.isdir(ICONS_DIR):
        print(f"icons/ folder not found :( THE FUCK ARE YOU DOING")
        return

    gdicons = sorted(
        f"icons/{f}"
        for f in os.listdir(ICONS_DIR)
        if f.lower().endswith(".gdicon")
    )

    with open(REGISTRY_PATH, "w", encoding="utf-8") as fp:
        json.dump(gdicons, fp, indent=2)

    print(f"registry updated with {len(gdicons)} total icons! listed:")
    for path in gdicons:
        print(f"  {path}")

if __name__ == "__main__":
    main()
