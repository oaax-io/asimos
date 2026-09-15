# Adresse, Parzelle und KI-Lagebeschreibung

## Umsetzung
- Die Adresssuche im Immobilienformular auf Google umstellen und bei Auswahl Strasse, PLZ, Ort, Land sowie Koordinaten übernehmen.
- Im Abschnitt „Adresse“ einen Abruf der amtlichen Schweizer Parzellennummer und EGRID über geo.admin.ch ergänzen; gefundene Werte direkt ins Formular übernehmen.
- Für die Lagebeschreibung eine Aktion „Mit KI generieren“ ergänzen, die vorhandene Objekt- und Adressdaten nutzt und den Text vor dem Speichern bearbeitbar einsetzt.
- Lagebeschreibung und Koordinaten additiv als optionale Immobilienfelder speichern; bestehende Felder und Abläufe bleiben erhalten.
- Google-Abfragen geschützt über die bestehende Anmeldung ausführen und Suchanfragen verzögern, begrenzen und pro Eingabe wiederverwenden.
- Den Adressschritt auf grossen und kleinen Bildschirmen sowie Speichern und Fehlermeldungen prüfen.

## Technische Details
- Google Places Autocomplete und Place Details serverseitig über die verbundene Google-Maps-Schnittstelle aufrufen; keine Google-Schlüssel im Browser verwenden.
- Für Parzellen zuerst die ausgewählten Koordinaten verwenden, in LV95 umrechnen und den amtlichen Kataster-Layer abfragen.
- Neue Datenbankfelder ausschliesslich nullable ergänzen: `location_description`, `latitude`, `longitude`; vorhandene `parcel_no`- und `e_grid`-Felder weiterverwenden.
