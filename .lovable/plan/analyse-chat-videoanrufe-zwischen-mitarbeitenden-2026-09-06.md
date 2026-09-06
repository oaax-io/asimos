# Analyse: Chat & Videoanrufe zwischen Mitarbeitenden

Nur Diagnose – es wurde nichts geändert.

## Antworten auf die sechs Fragen

1. **`video_calls` ist ein totes Datenmodell.** Ausser dem generierten Typen-File (`src/integrations/supabase/types.ts`) kommt der Name nirgends in `src/` vor – kein Lesen, kein Schreiben. Die Tabelle enthält 0 Zeilen. Räume werden ausschliesslich als String berechnet (Chat: `chat-<beide UserIDs sortiert>`, Termin: `roomOf(appointment)`), nirgends persistiert.

2. **`VideoCallDialog` wird nur bei Terminen verwendet** – `src/routes/_app/appointments.tsx` (Zeile 398 in der Terminkarte, Zeile 893 im Detail). Start: lokaler `callOpen`-State per Button; Raumname aus dem Termin; daneben „Link kopieren" (`/meet/<room>`). Die Gegenseite erfährt vom Start nichts – sie muss denselben Termin öffnen oder den kopierten Link bekommen. `CalendarHover.tsx` startet keinen Call.

3. **Bestätigt: es gibt keinerlei Anruf-Signalisierung.** In `ChatDock.tsx` (Z. 340–345, 374–382) setzt der Video-Button nur lokal `setCallOpen(true)` und holt ein LiveKit-Token. Kein Insert in `notifications`, kein Realtime-Broadcast, kein Klingeln, kein Badge, keine Nachricht beim Empfänger. Ein Anruf kommt nur zustande, wenn beide Seiten zufällig gleichzeitig denselben Chat öffnen und beide den Button drücken. Zusätzlich: der Call ist an `mode !== "minimized"` gekoppelt – wer das Chatfenster minimiert, verlässt den Raum sofort.

4. **LiveKit-Server ist erreichbar und aktiv.** `GET https://asimo-qmhupnro.livekit.cloud/` → `200 OK`; `/rtc/validate` → `401 "missing authorization header"` (erwartet ohne Token, d. h. Endpoint lebt). Das Projekt ist also gültig; `testLivekitConnection` würde ebenfalls „ok" liefern (es akzeptiert alles < 500). Video scheitert also nicht an der Infrastruktur.

5. **Realtime für `direct_messages` ist korrekt konfiguriert.** In Publication `supabase_realtime`: `profiles, tasks, notifications, direct_messages`. `REPLICA IDENTITY` für `direct_messages` und `profiles` = `FULL` (ideal). Abonnenten existieren in `ChatDock` (Thread) und `TeamInbox` (globaler Toast „Neue Nachricht von …" mit Öffnen-Aktion). Keine Fehler in den Build-Logs zu chat/livekit/realtime/presence. Es gibt **keinen** Trigger auf `direct_messages`, der einen Eintrag in `notifications` erzeugt – wer die App gerade nicht offen hat, bekommt gar nichts mit (keine Glocke, keine E-Mail). Datenlage: nur 6 Nachrichten insgesamt.

6. **Präsenz: ein reales Problem.** `PRESENCE_STALE_MS` = 2 Minuten, Heartbeat alle 45 s, aber der Heartbeat läuft nur bei `document.visibilityState === "visible"`. Ein Kollege mit der App in einem Hintergrund-Tab (Normalfall im CRM) wird nach 2 Minuten überall als **offline** angezeigt, obwohl er angemeldet ist. Zusätzlich schreibt `heartbeat()` nur `presence_updated_at` – das erzeugt bei 7 aktiven Nutzern alle 45 s ein `profiles`-UPDATE, das per Realtime bei allen `["team-members"]`, `["chat-member"]`, `["my-presence"]` invalidiert (unnötige Last, aber nicht die Ursache). Aktuell hat genau 1 von 7 Profilen einen frischen Heartbeat. `PresenceDot` selbst ist korrekt (Re-Render-Tick vorhanden).

## Diagnose, nach Relevanz sortiert

1. **Videoanruf hat keine Klingel/Signalisierung** (Frage 3) – Hauptgrund, warum „man sich nicht anrufen kann". Fehlt: Anruf-Event beim Empfänger (Realtime-Broadcast oder Zeile in `video_calls`/`notifications`) plus Annehmen/Ablehnen-UI.
2. **Anruf bricht beim Minimieren des Chatfensters ab** – selbst ein verabredeter Call ist fragil.
3. **`video_calls` ungenutzt** – es fehlt die Persistenz, die genau diese Signalisierung tragen könnte (Raum, Anrufer, Teilnehmer, Start/Ende, verpasste Anrufe).
4. **Chat funktioniert technisch**, aber nur solange die App offen ist: keine dauerhafte Benachrichtigung (kein Trigger nach `notifications`, keine Push/E-Mail), daher der Eindruck „niemand antwortet".
5. **Präsenz zeigt Kollegen fälschlich offline** (Hintergrund-Tab + 2-Minuten-Fenster) – verstärkt das Gefühl, niemand sei erreichbar.
6. **LiveKit-Infrastruktur ist in Ordnung** – hier ist nichts zu reparieren.

## Nächster Schritt (nicht ausgeführt)

Auf Wunsch erstelle ich einen Umsetzungsplan für: Anruf-Signalisierung über `video_calls` + Realtime (Klingeln, Annehmen/Ablehnen, verpasste Anrufe), Call unabhängig vom Fensterzustand, Chat-Benachrichtigung per Trigger in `notifications`, und robustere Präsenz (Heartbeat auch im Hintergrund bzw. grösseres Stale-Fenster).
