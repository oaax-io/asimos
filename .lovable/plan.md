# Bearbeitungsmodus für Immobilien verdichten

## Umsetzung
- Im Bearbeitungsdialog die bisherigen separaten Tabs „Objektart“, „Struktur“ und „Grunddaten“ zu einem Tab „Grunddaten“ zusammenführen.
- Objektart und Struktur dort als kompakte Auswahlfelder mit passendem Icon und Titel darstellen, ohne die grossen Auswahlkacheln des Erfassungsassistenten.
- Titel, Vermarktungsart, Status, Eigentümerschaft und Zuständigkeit auf derselben Seite belassen.
- Die übrigen Bearbeitungs-Tabs sowie den bestehenden Erfassungsassistenten unverändert lassen.
- Darstellung auf kleinen und grossen Bildschirmen prüfen und Speichern testen.

## Technische Details
- Bestehende Daten- und Speicherlogik des `PropertyWizard` wiederverwenden.
- Nur die Navigation und Darstellung im Modus „Bearbeiten“ anpassen; der Modus „Neu erfassen“ bleibt unverändert.
