// Informal ("Du") overlay for de_11ty.ts — applied when SHOP_FORMALITY=informal.
// Only keys whose text differs from the formal base; same nesting.
export default {
  cart: {
    empty: "Dein Warenkorb ist leer.",
  },
  checkout: {
    cartEmpty: "Dein Warenkorb ist leer.",
    error: "Ein Fehler ist aufgetreten. Bitte versuche es erneut.",
    serviceError: "Ein technischer Fehler ist aufgetreten. Bitte versuche es später erneut oder kontaktiere den Support.",
  },
  ageGate: {
    title: "Bist du mindestens {{age}} Jahre alt?",
    text: "Um diesen Shop zu betreten, musst du das gesetzliche Mindestalter für den Kauf von Alkohol erreicht haben.",
    note: "Mit der Bestätigung akzeptierst du, dass wir deine Angabe lokal in deinem Browser speichern.",
    deniedText: "Du musst mindestens {{age}} Jahre alt sein, um diesen Shop nutzen zu können.",
  },
  staticPages: {
    errorPage: {
      description: "404 - Ich kann diese Seite nicht finden! Bitte versuche, die Startseite zu besuchen. Bitte lass mich wissen, wenn weitere Fehler auftreten!",
      goToHomepage: "Am besten versuchst du es mit der <a href='/{{ url }}/'>Startseite!</a>",
      contactSupport: "Bitte lass mich wissen, wenn weitere Fehler auftreten, damit ich sie korrigieren kann: <a href='mailto:{{ email }}'>{{ email }}</a>",
    },
    userRegistration: {
      info: "Nach dem Registrieren senden wir Dir per E-Mail einen Link zu, mit dem du deinen Account aktivieren kannst.",
    },
    userRegistrationSuccess: {
      info: "Du bekommst in Kürze eine E-Mail, um deinen Account zu aktivieren.",
    },
    userConfirmSuccess: {
      info: "Dein Kundenkonto wurde erfolgreich aktiviert. Viel Spass beim Einkaufen!",
    },
    userRecover: {
      description: "Passwort für deinen Account zurücksetzen",
      info: "Bitte gib Deine E-Mail-Adresse an, mit der du dich bei uns registriert hast. Wir senden Dir dann einen Link, mit dem Du ein neues Passwort festlegen kannst.",
    },
    userRecoverSuccess: {
      info: "Du bekommst in Kürze eine E-Mail mit einem Link zum Zurücksetzen deines Passworts.",
    },
    userResetSuccess: {
      info: "Dein Passwort wurde erfolgreich geändert.",
    },
    newsletterConfirm: {
      info: "Bitte bestätige mit einem Klick, dass Du unseren Newsletter erhalten möchtest.",
    },
    newsletterConfirmSuccess: {
      info: "Vielen Dank! Du erhältst ab sofort unseren Newsletter.",
    },
    newsletterUnsubscribe: {
      info: "Schade, dass Du gehst. Klicke unten, um Dich von unserem Newsletter abzumelden.",
    },
    newsletterUnsubscribeSuccess: {
      info: "Du wurdest von unserem Newsletter abgemeldet und erhältst keine weiteren E-Mails.",
    },
    userOrders: {
      description: "Deine Bestellungen",
    },
    orderThankYou: {
      description: "Vielen Dank für Deine Bestellung!",
      heading: "Vielen Dank für Deine Bestellung!",
      headingNamed: "Vielen Dank für Deine Bestellung, {{name}}!",
      text: "Sobald Deine Bestellung bei uns eingegangen ist, erhältst Du eine Bestätigung per E-Mail.",
      succeeded: "Deine Bestellung ist bei uns eingegangen. Eine Bestätigung mit Deiner Bestellnummer erhältst Du per E-Mail.",
      succeededEmail: "Deine Bestellung ist bei uns eingegangen. Eine Bestätigung mit Deiner Bestellnummer ist unterwegs an {{email}}.",
      processing: "Deine Zahlung wird noch verarbeitet. Sobald sie bei uns eingegangen ist, erhältst Du eine Bestätigung per E-Mail – das kann einige Werktage dauern.",
      processingEmail: "Deine Zahlung wird noch verarbeitet. Sobald sie bei uns eingegangen ist, erhältst Du eine Bestätigung an {{email}} – das kann einige Werktage dauern.",
      summary: "Deine Bestellung",
      nextSteps: "Sobald Deine Bestellung versendet wird, schicken wir Dir eine Versandbestätigung per E-Mail.",
      nextStepsAgeRestricted: "Bitte beachte: Wir liefern nur an Personen ab 18 Jahren. Bei der Zustellung kann ein Altersnachweis verlangt werden.",
    },
    orderWithdraw: {
      info: "Du kannst Deine Bestellung innerhalb von 14 Tagen widerrufen. Bitte gib Deinen Namen, Deine Bestellnummer und die bei der Bestellung verwendete E-Mail-Adresse an.",
    },
    orderWithdrawSuccess: {
      description: "Dein Widerruf ist bei uns eingegangen",
      info: "Wir haben Deinen Widerruf erhalten und Dir eine Bestätigung per E-Mail geschickt.",
    },
  },
  forms: {
    errors: {
      service: "Ein technischer Fehler ist aufgetreten. Bitte versuche es später erneut.",
      rateLimited: "Zu viele Anfragen. Bitte versuche es in einer Minute erneut.",
    },
    fields: {
      name: {
        errorMessage: "Bitte gib Deinen Namen ein.",
      },
      email: {
        errorMessage: "Bitte gib eine gültige E-Mail Adresse ein.",
      },
      orderNumber: {
        errorMessage: "Bitte gib Deine Bestellnummer ein.",
      },
      registerForNewsletter: {
        privacyNotice: "Mit der Anmeldung stimmst du unserer <a href=\"{{url}}\">Datenschutzerklärung</a> zu.",
      },
      captcha: {
        errorMessage: "Bitte löse das Captcha, um fortzufahren.",
      },
    },
    newsletter: {
      intro: "Bleib auf dem Laufenden und abonniere unseren Newsletter.",
      privacyNotice: "Mit der Anmeldung stimmst du unserer <a href=\"{{url}}\">Datenschutzerklärung</a> zu. Du kannst dich jederzeit wieder abmelden.",
      successNotice: "Fast geschafft! Falls Du noch nicht angemeldet bist, erhältst Du in Kürze eine E-Mail mit einem Bestätigungslink.",
    },
  },
  cookies: {
    description: "Wir verwenden Cookies, um dein Browsing-Erlebnis zu verbessern, personalisierte Werbung oder Inhalte bereitzustellen und unseren Traffic zu analysieren. Durch Klick auf \"Alle akzeptieren\" stimmst du der Verwendung unserer Cookies zu. Du kannst deine Einstellungen unten verwalten.",
    essential: {
      accessToken: "Speichert dein Authentifizierungstoken für sicheren Login",
      refreshToken: "Erneuert deine Authentifizierung um dich angemeldet zu halten",
      cart: "Behält deinen Warenkorb über Sessions hinweg bei",
    },
    analytics: {
      description: "Wir verwenden Google Analytics, um die Nutzung unserer Website zu analysieren und zu verbessern. Die dabei erhobenen Daten werden anonymisiert verarbeitet. Du kannst die Verwendung von Analytics-Cookies akzeptieren oder ablehnen. Weitere Informationen findest du in unserer {{ privacyPolicy }}.",
    },
    marketing: {
      description: "Diese Cookies ermöglichen es uns, dir personalisierte Anzeigen zu zeigen und die Leistung von Marketingkampagnen zu verfolgen. Du kannst diese deaktivieren, ohne dass die Website-Funktionalität beeinträchtigt wird.",
    },
  },
  privacyPolicy: {
    controller: {
      text: "Verantwortlich für die Verarbeitung Deiner personenbezogenen Daten auf dieser Website ist {{company}}, {{address}}, E-Mail: {{email}}. Bei Fragen zum Datenschutz erreichst Du uns unter dieser Adresse.",
      dpo: "Unsere Datenschutzbeauftragte bzw. unseren Datenschutzbeauftragten erreichst Du unter: {{dpo}}",
    },
    overview: {
      textShop: "Wir verarbeiten nur die Daten, die für den Betrieb dieser Website und – soweit Du bestellst – für die Abwicklung Deiner Bestellung nötig sind. Wir verwenden keine Analyse- oder Tracking-Werkzeuge, keine Werbe-Cookies und keine Social-Media-Plugins. Im Folgenden erklären wir, welche Daten wir wofür verarbeiten, an wen sie gehen und wie lange wir sie speichern.",
    },
    content: {
      text: "Die Inhalte dieser Website verwalten wir mit {{provider}}. Bilder werden direkt von Sanitys Bildserver (cdn.sanity.io) geladen; dabei erhält Sanity Deine IP-Adresse und die Browser-Kennung. Rechtsgrundlage ist unser berechtigtes Interesse an einer schnellen und zuverlässigen Bereitstellung der Bilder (Art. 6 Abs. 1 lit. f DSGVO). Sanity verarbeitet die Daten als Auftragsverarbeiter, auch in den USA; die Übermittlung ist durch EU-Standardvertragsklauseln abgesichert.",
    },
    orders: {
      text: "Wenn Du bestellst, verarbeiten wir Deinen Namen, Deine E-Mail-Adresse, Rechnungs- und Lieferadresse, die bestellten Artikel und den Zahlungsstatus, um den Vertrag zu erfüllen (Art. 6 Abs. 1 lit. b DSGVO) und unsere gesetzlichen Aufbewahrungspflichten zu erfüllen (Art. 6 Abs. 1 lit. c DSGVO). Die Bestelldaten speichern wir bei {{provider}} (Auftragsverarbeiter). Bestellungen bewahren wir sieben Jahre ab Ende des Kalenderjahres auf (§ 132 BAO). Daten eines begonnenen, aber nicht bezahlten Bestellvorgangs löschen wir nach {{days}} Tagen.",
      carrier: "Für den Versand geben wir Deinen Namen und die Lieferadresse an das beauftragte Paketdienstleistungsunternehmen weiter, das sie als eigener Verantwortlicher verarbeitet (Art. 6 Abs. 1 lit. b DSGVO). Deine E-Mail-Adresse geben wir nicht weiter.",
    },
    payment: {
      text: "Zahlungen wickeln wir über {{provider}} (Stripe Payments Europe Ltd., Irland) ab. Dafür erhält Stripe die Zahlungsdaten, die Du im Zahlungsformular eingibst, sowie Name, E-Mail-Adresse, Betrag, IP-Adresse und Geräteinformationen. Wir selbst sehen keine vollständigen Karten- oder Kontodaten. Rechtsgrundlage ist die Vertragserfüllung (Art. 6 Abs. 1 lit. b DSGVO).",
      wallets: "Wenn Du mit Apple Pay oder Google Pay bezahlst, verarbeiten zusätzlich Apple bzw. Google Daten zur Zahlung nach ihren eigenen Datenschutzbestimmungen.",
    },
    email: {
      text: "E-Mails wie Bestellbestätigungen, Versandinformationen und – soweit genutzt – Kontobestätigungen oder Newsletter-Bestätigungen versenden wir über {{provider}}. Dafür erhält der Dienst Deine E-Mail-Adresse und den Inhalt der E-Mail. Rechtsgrundlage ist die Vertragserfüllung (Art. 6 Abs. 1 lit. b DSGVO) bzw. Deine Einwilligung beim Newsletter.",
    },
    withdrawal: {
      text: "Wenn Du über unser Formular vom Vertrag zurücktrittst, verarbeiten wir Bestellnummer, E-Mail-Adresse, Deine Erklärung und deren Zeitpunkt, um den Widerruf zu bearbeiten und Dir den Eingang zu bestätigen (Art. 6 Abs. 1 lit. c DSGVO in Verbindung mit dem FAGG). Wir speichern diese Daten zusammen mit der Bestellung.",
    },
    account: {
      text: "Wenn Du ein Kundenkonto anlegst, speichern wir Deine E-Mail-Adresse, Deinen Namen und die Angaben aus dem Registrierungsformular, damit Du Dich anmelden und Deine Daten verwalten kannst (Art. 6 Abs. 1 lit. b DSGVO). Anmeldung und Konten verwalten wir über {{provider}} (Auftragsverarbeiter; Übermittlungen in die USA auf Grundlage der EU-Standardvertragsklauseln). Für die Anmeldung setzen wir die Cookies sb_access_token und sb_refresh_token; sie sind dafür unbedingt erforderlich. Dein Konto und diese Daten löschen wir, wenn Du das Konto löschen lässt; Bestellungen bleiben für die gesetzliche Aufbewahrungsfrist erhalten.",
    },
    newsletter: {
      text: "Wenn Du unseren Newsletter abonnierst, speichern wir Deine E-Mail-Adresse auf Grundlage Deiner Einwilligung (Art. 6 Abs. 1 lit. a DSGVO). Die Anmeldung wird erst wirksam, wenn Du den Link in unserer Bestätigungs-E-Mail anklickst (Double-Opt-in); dafür speichern wir einen Bestätigungscode und den Zeitpunkt. Du kannst die Einwilligung jederzeit widerrufen – über den Abmeldelink in jedem Newsletter oder per E-Mail an uns. Danach löschen wir Deine Adresse aus dem Verteiler. Die Daten liegen bei {{provider}}, der Versand erfolgt über den unter „E-Mail-Versand“ genannten Dienst.",
    },
    captcha: {
      text: "Um Formulare ({{forms}}) vor automatisiertem Missbrauch zu schützen, verwenden wir {{provider}} (Intuition Machines, Inc., USA). hCaptcha erhält dabei Deine IP-Adresse und Merkmale Deines Browsers und Geräts, um zu prüfen, ob die Eingabe von einem Menschen stammt. hCaptcha wird erst geladen, wenn ein solches Formular angezeigt wird. Rechtsgrundlage ist unser berechtigtes Interesse am Schutz vor Spam und Missbrauch (Art. 6 Abs. 1 lit. f DSGVO). Die Übermittlung in die USA ist durch das EU-US Data Privacy Framework abgesichert.",
    },
    vinofact: {
      text: "Auf Produktseiten zeigen wir Weinbilder (z. B. Flaschenfotos) von vinofact, die direkt von dessen Server (i.vinofact.com) geladen werden. Dabei erhält der Anbieter Deine IP-Adresse und die Browser-Kennung. Rechtsgrundlage ist unser berechtigtes Interesse an vollständigen Produktinformationen (Art. 6 Abs. 1 lit. f DSGVO). Anbieter ist {{provider}}, Dr. Hoyosstraße 12, 4311 Schwertberg, Österreich.",
    },
    storage: {
      intro: "Wir setzen keine Cookies zu Analyse- oder Werbezwecken. Wir speichern nur, was für die von Dir genutzten Funktionen unbedingt erforderlich ist; dafür ist keine Einwilligung nötig (§ 165 Abs. 3 TKG 2021). Die Daten bleiben in Deinem Browser und werden nicht an uns übertragen:",
      items: {
        orderSnapshot: "eine Zusammenfassung Deiner Bestellung für die Bestätigungsseite – nur bis Du den Tab schließt,",
        ageGate: "Deine Bestätigung des Mindestalters,",
        search: "Deine letzten Suchbegriffe.",
      },
      outro: "Du kannst diese Daten jederzeit in den Einstellungen Deines Browsers löschen.",
      outroCookies: "Du kannst diese Daten jederzeit in den Einstellungen Deines Browsers löschen. Cookies für Zahlung und Kundenkonto sind in den jeweiligen Abschnitten beschrieben.",
      none: "Wir setzen keine Cookies und speichern keine Daten in Deinem Browser.",
    },
    required: {
      text: "Für eine Bestellung benötigen wir Name, Rechnungs- und Lieferadresse sowie Deine E-Mail-Adresse; ohne diese Angaben können wir den Vertrag nicht abschließen oder erfüllen. Weitere Felder sind freiwillig.",
    },
    automated: {
      stripe: "Stripe prüft Zahlungen automatisiert auf Betrug und kann eine Zahlung dabei ablehnen (siehe „Zahlung“); wende Dich in diesem Fall an uns.",
    },
    rights: {
      heading: "Deine Rechte",
      text: "Du hast das Recht auf Auskunft über Deine bei uns gespeicherten Daten (Art. 15 DSGVO), auf Berichtigung (Art. 16), Löschung (Art. 17), Einschränkung der Verarbeitung (Art. 18) und Datenübertragbarkeit (Art. 20). Verarbeiten wir Daten auf Grundlage unseres berechtigten Interesses, kannst Du dem widersprechen (Art. 21). Eine Einwilligung kannst Du jederzeit mit Wirkung für die Zukunft widerrufen. Wende Dich dazu an {{email}}.",
    },
    complaint: {
      text: "Wenn Du der Meinung bist, dass wir Deine Daten nicht rechtmäßig verarbeiten, kannst Du Dich bei der Aufsichtsbehörde beschweren. In Österreich ist das die Datenschutzbehörde, Barichgasse 40–42, 1030 Wien, {{dsb}}.",
    },
  },
}
