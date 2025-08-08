---
name: Add / Update Property Rating
about: Submit a property rating; the bot commits to data/properties.json
title: "Rating: <short-address-or-id>"
labels: ["rating"]
assignees: []
---

Paste JSON between the fences. One object per Issue. The `property_id` is the unique key (slug URL or your own).

```json
{
  "property_id": "rightmove-163446314",
  "address": "Dulwich area (example)",
  "url": "https://www.rightmove.co.uk/property-...",
  "price": 385000,
  "bedrooms": 2,
  "tenure": "Share of freehold",
  "zone": 2,
  "travel_time_to_zone1": 25,
  "epc": "C",

  "viewing_date": "2025-08-08",

  "layout": 8,
  "light": 7,
  "noise": 4,
  "outdoor": 6,
  "kitchen": 7,
  "bathroom": 6,
  "area_vibe": 8,

  "notes": "South-facing living room; needs bathroom refresh."
}
