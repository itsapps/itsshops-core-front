export default {
  api: {
    errors: {
      validation: {
        email: "Ungültige E-Mail Adresse",
        password: "Ungültiges Passwort",
        message: "Validierungsfehler",
        empty: "Eingabe darf nicht leer sein",
        countryShippingNotSupported: "In das gewünschte Land kann nicht geliefert werden",
        shippingRateCountryMismatch: "Versand und Lieferland stimmen nicht zusammen",
        shippingRateMustBeProvided: "Versandart muss angegeben werden",
      },
      auth: {
        activationLinkExpired: "Der Link zum Bestätigen des Benutzerkontos ist nicht mehr gültig oder abgelaufen",
        unknown: "Unbekannter Fehler während der Authentifizierung",
        invalidCredentials: "Login fehlgeschlagen. E-Mail oder Passwort falsch.",
        notAuthenticated: "Nicht eingeloggt oder abgelaufene Session",
        maybeNotConfirmed: "Login fehlgeschlagen. Falls Du deine Registrierung noch nicht bestätigt hast, solltest Du in Kürze eine E-Mail bekommen.",
        noEmail: "Keine E-Mail Adresse enthalten.",
        captchaFailed: "Captcha-Überprüfung fehlgeschlagen",
      },
      service: "Service nicht verfügbar, bitte später nochmals versuchen",
      shipping: {
        noShippingCountries: "Keine Versandmöglichkeiten im System.",
        noSupportedShippingCountries: "Keine Versandmöglichkeiten im System.",
      },
      payment: {
        productZeroAmount: "Ein Produkt mit einer Menge von 0 ist im Warenkorb",
        noValidProducts: "Keine gültigen Produkte im Warenkorb",
        general: "Während des Zahlvorgangs ist ein Fehler aufgetreten"
      },
      orderNotFound: "Bestellung nicht gefunden",
      refundFailed: "Rückerstattung fehlgeschlagen",
    },
    voucher: {
      condition: {
        product: 'Beim Kauf des Produkts "{{title}}"',
        category: 'Beim Kauf eines Produkts aus der Kategorie "{{title}}"',
        categoryMinQuantity: 'Beim Kauf von mindestens {{quantity}} Produkten aus der Kategorie "{{title}}"',
        totalValue: 'Bestellung mit einem Mindestwert von {{amount}}',
        quantity: 'Beim Kauf des Produkts "{{title}}" mit mindestens {{quantity}} Stück',
        userStatus: {
          new: 'Neue Kunden',
          registered: 'Registrierte Kunden',
        }
      }
    }
  },
  countries: {
    AT: "Österreich",
    DE: "Deutschland",
    CH: "Schweiz",
    IT: "Italien",
    BE: "Belgien",
    DK: "Dänemark",
    ES: "Spanien",
    FI: "Finnland",
    FR: "Frankreich",
    GB: "Großbritannien",
    IE: "Irland",
    NL: "Niederlande",
    NO: "Norwegen",
    PL: "Polen",
    PT: "Portugal",
    SE: "Schweden",
  },
  emails: {
    headline: "Hallo {{customerName}}!",
    billedTo: "Rechnungsadresse",
    shippedTo: "Lieferadresse",
    billedAndShippedTo: "Rechnungs- und Lieferadresse",
    orderNumber: "Bestellnummer",
    invoiceNumber: "Rechnungsnummer",
    invoiceDate: "Rechnungsdatum",
    trackingNumber: "Sendungsnummer",
    vatText: "Umsatzsteuerbefreit - Kleinunternehmer gem. § 6 Abs. 1 Z 27 UStG",
    stockLevels: {
      subject: "Lagerbestände {{date}}",
      headline: "Lagerbestände am {{date}}",
      infoLine: "{{stock}} x <a href='{{editUrl}}'>{{title}}</a>",
      products: "Produkte",
      variants: "Produktvarianten",
    },
    order: {
      summaryProducts: "Produkte",
      summaryShipping: "Versand",
      summaryDiscount: "Rabatt",
      summaryTotal: "Gesamtsumme",
      summaryTax: "inkl. {{tax}} Steuern",
      invoice: "Rechnung",
      bankAccount: "Bankverbindung",
      iban: "IBAN",
      bic: "BIC",
      orderDate: "Bestelldatum",
      customerNumber: "Kundennummer",
      trackShipment: "Sendung verfolgen",
    },
    orderConfirmation: {
      subject: "Bestellbestätigung 🐠",
      preview: "Danke für Deinen Einkauf!",
      text: "Vielen Dank für Deinen Einkauf. Deine Bestellung ist bei uns eingegangen und wird in Kürze bearbeitet.",
    },
    orderProcessing: {
      subject: "Bestellung in Bearbeitung ⚙️",
      preview: "Deine Bestellung wird nun bearbeitet.",
      text: "Vielen Dank für Deinen Einkauf. Deine Bestellung wird nun bearbeitet und in Kürze versendet.",
    },
    orderInvoice: {
      subject: "Rechnung 💶",
      preview: "Deine Rechnung als PDF im Anhang",
      text: "Hier ist Deine Rechnung als PDF im Anhang. Vielen Dank für Deinen Einkauf!",
    },
    orderShipping: {
      subject: "Bestellung versendet 📦",
      preview: "Es wird nicht mehr lange dauern, bis Du Deine Bestellung in den Händen hast!",
      text: "Wir freuen uns, Dir mitteilen zu können, daß Deine Bestellung unterwegs ist. Du wirst die Lieferung schon bald in Deinen Händen halten.",
    },
    orderDelivered: {
      subject: "Bestellung geliefert 🏠",
      preview: "Deine Bestellung ist angekommen!",
      text: "Vielen Dank für den Einkauf und viel Spass mit deinen neuen Produkten!",
    },
    orderReturned: {
      subject: "Retoure angekommen 🏠",
      preview: "Deine Retoursendung ist bei uns angekommen!",
      text: "Vielen Dank für den Aufwand!",
    },
    orderCanceled: {
      subject: "Bestellung storniert 🛑",
      preview: "Deine Bestellung wurde storniert!",
      text: "Vielen Dank, daß Du uns geholfen hast!",
    },
    orderRefunded: {
      subject: "Zahlung zurückerstattet 🛑",
      preview: "Deine Zahlung wurde zurückerstattet!",
      text: "Die Zahlung wurde zurückerstattet!",
    },
    orderRefundedPartially: {
      subject: "Zahlung teilweise zurückerstattet 🛑",
      preview: "Deine Zahlung wurde teilweise zurückerstattet!",
      text: "Die Zahlung wurde teilweise zurückerstattet!",
    },
    userConfirmation: {
      subject: "Kundenregistrierung 👤",
      preview: "Registrierung bestätigen",
      headline: "Hi!",
      text: "Bitte folge dem Link, um Dein Kundenkonto zu bestätigen.",
      urlTitle: "Kundenkonto bestätigen",
    },
    userInvitation: {
      subject: "Du bist eingeladen! 🎉",
      preview: "Du bist eingeladen, unserem Webshop beizutreten",
      headline: "Willkommen!",
      text: "Du bist eingeladen, unserem Webshop beizutreten. Klicke auf den folgenden Link, um Dein Passwort zu setzen und loszulegen.",
      urlTitle: "Passwort setzen",
    },
    userReset: {
      subject: "Passwort zurücksetzen 🪪",
      preview: "Neues Passwort setzen",
      headline: "Hi!",
      text: "Bitte folge dem Link, um ein neues Passwort für Dein Kundenkonto zu setzen.",
      urlTitle: "Neues Passwort setzen",
    }
  },
  orders: {
    statusTexts: {
      created: 'Erstellt',
      processing: 'In Bearbeitung',
      shipped: 'Versendet',
      delivered: 'Angekommen',
      canceled: 'Storniert',
      returned: 'Zurückgeliefert',
    }
  },
};
