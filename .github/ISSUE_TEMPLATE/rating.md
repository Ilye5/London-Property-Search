name: Add / Update Property Rating (Guided Form)
description: Submit a property with guided fields. No JSON required.
title: "Rating: <short-address-or-id>"
labels: ["rating"]
body:
  - type: input
    id: property_url
    attributes:
      label: Property URL (Rightmove/Zoopla/etc.)
      description: Paste the listing URL. Used to derive a unique property_id.
      placeholder: https://www.rightmove.co.uk/property-...
    validations:
      required: true

  - type: input
    id: address
    attributes:
      label: Address (short)
      description: e.g., "Dulwich — XYZ Street, SE22"
    validations:
      required: true

  - type: input
    id: postcode
    attributes:
      label: Postcode (or lat,lon)
      description: Use the helper on the website to geocode if unsure.
      placeholder: SE22 9XX  (or 51.4619,-0.0900)
    validations:
      required: true

  - type: input
    id: price
    attributes:
      label: Price (£)
      placeholder: 385000
    validations:
      required: true

  - type: dropdown
    id: bedrooms
    attributes:
      label: Bedrooms
      options:
        - "1"
        - "2"
        - "3"
        - "4"
        - "5+"
    validations:
      required: true

  - type: dropdown
    id: tenure
    attributes:
      label: Tenure
      options:
        - Freehold
        - Share of freehold
        - Leasehold
        - Unknown
    validations:
      required: true

  - type: dropdown
    id: zone
    attributes:
      label: Zone (approx)
      options:
        - "1"
        - "2"
        - "3"
        - "4"
        - "5+"
    validations:
      required: true

  - type: input
    id: viewing_date
    attributes:
      label: Last viewed (YYYY-MM-DD)
      placeholder: 2025-08-08
    validations:
      required: false

  - type: input
    id: travel_minutes
    attributes:
      label: Travel to Zone 1 (minutes)
      description: From helper panel; estimate to e.g., Bank/Victoria.
      placeholder: "25"
    validations:
      required: false

  - type: input
    id: nearest_tube
    attributes:
      label: Nearest Tube stop (from helper)
      placeholder: Denmark Hill
    validations:
      required: false

  - type: input
    id: distance_to_bank_km
    attributes:
      label: Distance to Bank (km, straight-line)
      placeholder: "7.3"
    validations:
      required: false

  - type: dropdown
    id: epc
    attributes:
      label: EPC
      options: [A, B, C, D, E, F, G, Unknown]
    validations:
      required: false

  - type: textarea
    id: subjective
    attributes:
      label: Quick subjective ratings (0–10 each)
      description: "Format: layout=8, light=7, noise=4, outdoor=6, kitchen=7, bathroom=6, area_vibe=8"
      placeholder: "layout=8, light=7, noise=4, outdoor=6, kitchen=7, bathroom=6, area_vibe=8"
    validations:
      required: false

  - type: textarea
    id: notes
    attributes:
      label: Notes
      placeholder: South-facing living room; needs bathroom refresh.
    validations:
      required: false
