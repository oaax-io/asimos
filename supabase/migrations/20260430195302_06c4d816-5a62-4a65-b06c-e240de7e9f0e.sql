UPDATE document_templates SET content = '<!--skin:asimo-->
<div class="a-header">
  <h1 class="a-title">Maklermandat <span class="sub">/ Exklusiv</span></h1>
  <img src="{{logo_url}}" alt="{{company_name}}" class="a-logo" />
</div>

<div class="a-parties">
  <div>
    <div class="a-zwischen">zwischen</div>
    <div class="a-party-l">
      {{company.legal_name}}<br/>
      {{company.address}}<br/>
      {{company.postal_code}} {{company.city}}<br/>
      <span style="color:#6b7280;">(nachfolgend „Auftragnehmer")</span>
    </div>
  </div>
  <div>
    <div class="a-parties-r-label">und (nachfolgend: <strong>Auftraggeber</strong>)</div>
    <div class="a-formgrid">
      <div class="lbl">Firma</div><div class="val">{{client.full_name}}</div>
      <div class="lbl">Ort/PLZ</div><div class="val">{{client.postal_code}} {{client.city}}</div>
      <div class="lbl">Vorname</div><div class="val"></div>
      <div class="lbl">Telefon</div><div class="val">{{client.phone}}</div>
      <div class="lbl">Name</div><div class="val"></div>
      <div class="lbl">E-Mail</div><div class="val">{{client.email}}</div>
      <div class="lbl">Strasse + Nr.</div><div class="val">{{client.address}}</div>
      <div class="lbl">UID</div><div class="val">--</div>
    </div>
  </div>
</div>

<div class="a-objekt" style="width: calc(50% - 11px); float: left; margin-right: 22px;">
  <h3>Objektart / Bezeichnung</h3>
  <div class="a-checks-row">
    <span class="a-check"><span class="bx on">✕</span>MFH</span>
    <span class="a-check"><span class="bx"></span>EFH</span>
    <span class="a-check"><span class="bx"></span>Wohnung</span>
    <span class="a-check"><span class="bx"></span>Gewerbeimmobilie</span>
    <span class="a-check"><span class="bx"></span>Reihenhaus</span>
    <span class="a-check"><span class="bx"></span>Doppelhaus</span>
    <span class="a-check"><span class="bx"></span>Grundstück</span>
    <span class="a-check"><span class="bx"></span>Garagen-/Stellplatz</span>
  </div>
  <div class="a-formgrid">
    <div class="lbl">Strasse + Nr.</div><div class="val">{{property.address}}</div>
    <div class="lbl">Ort/PLZ</div><div class="val">{{property.postal_code}} {{property.city}}</div>
    <div class="lbl highlight">Verkaufspreis</div><div class="val"><strong>{{property.price}}</strong></div>
  </div>
</div>

<div class="a-body-cols">
  <div class="a-section">
    <h4>1. Mandatumfang</h4>
    <p>Der Immobilienmakler wird beauftragt, die oben genannte Immobilie zu verkaufen. Der Makler verpflichtet sich, alle erforderlichen Massnahmen zur Vermarktung der Immobilie zu ergreifen, einschliesslich der Erstellung von Exposés, der Durchführung von Besichtigungen und der Verhandlung mit potenziellen Käufern.</p>
  </div>

  <div class="a-section">
    <h4>2. Provision</h4>
    <p>Der Verkäufer verpflichtet sich, dem Immobilienmakler eine Provision (wie unten angekreuzt in Prozent oder Pauschal) des Verkaufspreises zu zahlen, die bei erfolgreichem Abschluss des Kaufvertrages fällig wird. Die Provision ist zur Zahlung fällig, sobald der notarielle Kaufvertrag zwischen Käufer und Verkäufer beurkundet worden ist. Der Auftraggeber hat das Recht, die Immobilie selbst zu verkaufen, ohne dass dabei eine Provision geschuldet wird, sofern die Auftragnehmerin mit einer möglichen Kundschaft noch keine Reservation abgeschlossen ist.</p>
    <div class="commission-row">
      <span><span class="bx"></span>2.5%</span>
      <span><span class="bx"></span>3%</span>
      <span><span class="bx"></span>4%</span>
      <span><span class="bx"></span>5%</span>
      <span><span class="bx on">✕</span>Pauschalbetrag:</span>
      <span class="pauschal-val">CHF {{commission_value}}</span>
    </div>
  </div>

  <div class="a-section">
    <h4>3. Provisionsschutz</h4>
    <p>Kommt es nach Auflösen des Vertrags innerhalb von zwei Jahren zu einem Geschäftsabschluss mit einem Interessenten, der auf die Kontakte und Bemühungen des Auftragnehmers zurückzuführen ist, ist die volle Provision geschuldet.</p>
  </div>

  <div class="a-section">
    <h4>4. Exklusivität</h4>
    <p>Der Verkäufer gewährt dem Makler das alleinige und exklusive Recht, die Immobilie zu verkaufen. Der Auftraggeber verpflichtet sich, keine weiteren Makler mit der Vermarktung der Immobilie zu beauftragen und den Verkauf der Immobilie nicht selbst durchzuführen oder durch Dritte vornehmen zu lassen, solange dieses Mandat besteht.</p>
  </div>

  <div class="a-section">
    <h4>5. Rücktritt</h4>
    <p>Sollte sich der Verkäufer vor Abschluss des Verkaufs vom Mandat zurückziehen, wird eine Pauschalentschädigung in Höhe von CHF 5''000 für den bereits entstandenen Bearbeitungs- und Marketingaufwand fällig.</p>
  </div>

  <div class="a-section">
    <h4>6. Dauer des Mandats</h4>
    <p>Dieses Mandat tritt mit Unterzeichnung in Kraft und ist unbefristet. Es kann von beiden Parteien mit einer Kündigungsfrist von drei Monaten zum Monatsende gekündigt werden. Es entstehen für den Auftraggeber während der Vertragslaufzeit keine Gebühren.</p>
  </div>

  <div class="a-section">
    <h4>7. Schlussbestimmungen</h4>
    <p>Änderungen und Ergänzungen dieses Mandats bedürfen der Schriftform. Sollte eine Bestimmung dieses Mandats unwirksam sein, bleibt die Wirksamkeit der übrigen Bestimmungen unberührt.</p>
  </div>
</div>

<div style="clear: both;"></div>

<div class="a-signatures" style="display: grid; grid-template-columns: 1fr 1fr; gap: 24px;">
  <div>
    <div class="a-sig">
      <div class="line"></div>
      <div class="label">Ort und Datum</div>
    </div>
  </div>
  <div>
    <div class="a-sig">
      <div class="line"></div>
      <div class="label">Unterschrift Auftraggeber (Verkäufer)</div>
    </div>
    <div class="a-sig">
      <div class="line"></div>
      <div class="label">Unterschrift Auftragsnehmer ({{company.name}})</div>
    </div>
  </div>
</div>
', updated_at = now() WHERE id = '2e705a98-934d-4335-a250-b6b8681e0a83';