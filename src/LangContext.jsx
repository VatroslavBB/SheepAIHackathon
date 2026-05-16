import { createContext, useContext, useState } from 'react'

export const T = {
  hr: {
    header: {
      title: 'SPLIT // PROMETNI AGENT',
      vehicles: 'VOZILA', lines: 'LINIJA', incidents: 'INCIDENTI', works: 'RADOVI',
      driving: 'u vožnji', offline: 'offline',
    },
    toolbar: {
      locate: 'Moja lokacija', pin: 'Dodaj navigacijski pin', clear: 'Obriši pinove i lokaciju',
    },
    hints: {
      pinMode: 'Klikni na kartu za dodavanje pina',
      clickToReport: 'Klikni na kartu za prijavu incidenta',
      validating: 'Provjera lokacije...',
      notNearRoad: 'Odabrana lokacija nije dovoljno blizu ceste.',
      invalidArea: (what) => `Incident se ne može prijaviti na ${what}.`,
      areaNames: {
        sea: 'more', bay: 'zaljev', water: 'vodu', wetland: 'močvaru',
        wood: 'šumu', forest: 'šumu', scrub: 'šikaru', beach: 'plažu',
        sand: 'pijesak', meadow: 'livadu', farmland: 'polje', grass: 'travnjak',
        cemetery: 'groblje', ocean: 'ocean',
      },
    },
    map: {
      status: { 1: 'U vožnji', 3: 'Na stajalištu', 6: 'Izvan usluge' },
      yourLocation: 'Vaša lokacija',
      incident: { jam: 'Gužva', accident: 'Nesreća', closed: 'Zatvoreno' },
      works: 'Radovi',
      severity: 'Ozbiljnost',
      sev: { low: 'Mala', medium: 'Srednja', high: 'Visoka' },
      confirmations: 'potvrda',
      confirm: '+ Potvrdi',
      available: 'Dostupno', bikes: 'bicikala', ebikes: 'e-bicikla', freeRacks: 'Slobodnih mjesta',
      bikePrice: '1 EUR / 30 min · 5 EUR / dan',
    },
    report: {
      title: 'Prijavi incident',
      location: 'Lokacija', locationPlaceholder: 'npr. Solinska cesta, Kopilica...',
      severity: 'Ozbiljnost',
      cancel: 'Odustani', submit: 'Pošalji', submitting: 'Šaljem...',
      types: { jam: 'Gužva', accident: 'Nesreća', closed: 'Zatvoreno' },
      sevs: { low: 'Mala', medium: 'Srednja', high: 'Visoka' },
    },
    summary: {
      label: 'Prometna situacija',
      incident: (n) => `${n} ${n === 1 ? 'incident' : 'incidenta'}`,
      analyzing: 'Analiziram...',
    },
    chat: {
      header: 'AI AGENT // llama-3.1-70b',
      placeholder: 'Pitaj o prometu...',
      welcome: 'Zdravo! Pitaj me o autobusima u Splitu.\n📍 Tapni za svoju lokaciju → predložit ću najbliže linije\n📌 Dodaj pin odredišta → reći ću ti kako doći tamo',
      error: 'Greška pri komunikaciji s agentom.',
      quickPrompts: [
        { label: 'Linija 7?',  text: 'Gdje je sada linija 7 i u kojem smjeru ide?' },
        { label: '→ Kampus',   text: 'Koje linije idu prema Kampusu FESB?' },
        { label: '→ Bačvice',  text: 'Koji autobus me može odvesti na Bačvice?' },
        { label: 'Statistika', text: 'Koliko autobusa je aktivno i koje linije voze?' },
      ],
    },
    pin: { prompt: 'Naziv pina', placeholder: 'npr. Dom, Posao...', cancel: 'Odustani', confirm: 'Dodaj' },
  },

  en: {
    header: {
      title: 'SPLIT // TRAFFIC AGENT',
      vehicles: 'VEHICLES', lines: 'LINES', incidents: 'INCIDENTS', works: 'WORKS',
      driving: 'in service', offline: 'offline',
    },
    toolbar: {
      locate: 'My location', pin: 'Add navigation pin', clear: 'Clear pins & location',
    },
    hints: {
      pinMode: 'Click on the map to add a pin',
      clickToReport: 'Click on the map to report an incident',
      validating: 'Checking location...',
      notNearRoad: 'Selected location is not close enough to a road.',
      invalidArea: (what) => `Cannot report an incident on ${what}.`,
      areaNames: {
        sea: 'the sea', bay: 'a bay', water: 'water', wetland: 'a wetland',
        wood: 'a forest', forest: 'a forest', scrub: 'scrubland', beach: 'a beach',
        sand: 'sand', meadow: 'a meadow', farmland: 'farmland', grass: 'grassland',
        cemetery: 'a cemetery', ocean: 'the ocean',
      },
    },
    map: {
      status: { 1: 'In service', 3: 'At stop', 6: 'Out of service' },
      yourLocation: 'Your location',
      incident: { jam: 'Traffic jam', accident: 'Accident', closed: 'Closed' },
      works: 'Roadworks',
      severity: 'Severity',
      sev: { low: 'Low', medium: 'Medium', high: 'High' },
      confirmations: 'confirmations',
      confirm: '+ Confirm',
      available: 'Available', bikes: 'bikes', ebikes: 'e-bikes', freeRacks: 'Free racks',
      bikePrice: '€1 / 30 min · €5 / day',
    },
    report: {
      title: 'Report incident',
      location: 'Location', locationPlaceholder: 'e.g. Solinska road, Kopilica...',
      severity: 'Severity',
      cancel: 'Cancel', submit: 'Submit', submitting: 'Submitting...',
      types: { jam: 'Traffic jam', accident: 'Accident', closed: 'Closed' },
      sevs: { low: 'Low', medium: 'Medium', high: 'High' },
    },
    summary: {
      label: 'Traffic situation',
      incident: (n) => `${n} ${n === 1 ? 'incident' : 'incidents'}`,
      analyzing: 'Analyzing...',
    },
    chat: {
      header: 'AI AGENT // llama-3.1-70b',
      placeholder: 'Ask about traffic...',
      welcome: 'Hello! Ask me about buses in Split.\n📍 Tap for your location → I\'ll suggest the nearest lines\n📌 Add a destination pin → I\'ll tell you how to get there',
      error: 'Error communicating with the agent.',
      quickPrompts: [
        { label: 'Line 7?',   text: 'Where is line 7 now and which direction is it heading?' },
        { label: '→ Campus',  text: 'Which lines go towards FESB Campus?' },
        { label: '→ Bačvice', text: 'Which bus can take me to Bačvice beach?' },
        { label: 'Stats',     text: 'How many buses are active and which lines are running?' },
      ],
    },
    pin: { prompt: 'Pin name', placeholder: 'e.g. Home, Work...', cancel: 'Cancel', confirm: 'Add' },
  },
}

const LangContext = createContext()

export function LangProvider({ children }) {
  const [lang, setLang] = useState('hr')
  return (
    <LangContext.Provider value={{ lang, setLang, t: T[lang] }}>
      {children}
    </LangContext.Provider>
  )
}

export const useLang = () => useContext(LangContext)
