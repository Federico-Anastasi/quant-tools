#!/usr/bin/env python3
"""Add dark background to logo.png"""

from PIL import Image

# Open the transparent PNG
logo = Image.open('public/logo.png').convert('RGBA')

# Create dark background (same size as logo)
# Using #0a0a0a (very dark, like the site background)
background = Image.new('RGBA', logo.size, (10, 10, 10, 255))

# Composite logo on top of background
final = Image.alpha_composite(background, logo)

# Convert to RGB (remove alpha channel) and save
final_rgb = final.convert('RGB')
final_rgb.save('public/logo.png', 'PNG')

print("Added dark background to logo.png")
print("Background color: #0a0a0a (dark)")
print("Size: 512x512px")
