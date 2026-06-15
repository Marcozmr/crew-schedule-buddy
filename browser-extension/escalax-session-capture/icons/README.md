# Ícones da extensão

Gere os PNGs a partir de `icon.svg` com qualquer ferramenta (Inkscape, rsvg-convert, etc.):

```bash
# Com rsvg-convert (Linux/macOS):
rsvg-convert -w 16  -h 16  icon.svg -o icon16.png
rsvg-convert -w 48  -h 48  icon.svg -o icon48.png
rsvg-convert -w 128 -h 128 icon.svg -o icon128.png

# Com Inkscape:
inkscape --export-png=icon16.png  --export-width=16  icon.svg
inkscape --export-png=icon48.png  --export-width=48  icon.svg
inkscape --export-png=icon128.png --export-width=128 icon.svg
```

Ou use o conversor online: https://cloudconvert.com/svg-to-png

Os arquivos PNG gerados devem ficar nesta mesma pasta `icons/`.
