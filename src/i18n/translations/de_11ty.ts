export default {
  home: {
    welcome: "Willkommen",
    welcomeText: "... bei Fliegenfischen mit Herz",
  },
  navigation: {
    search: "Suche",
    toggleSearchAria: "Suche ein-/ausblenden",
    goHome: "Zur Startseite",
  },
  general: {
    retry: "Erneut versuchen",
    back: 'Zurück',
    skipText: 'Zum Hauptinhalt springen',
    toc: 'Inhaltsverzeichnis',
    skipToc: 'Inhaltsverzeichnis überspringen',
    isLoading: 'Wird geladen',
    registerNew: 'Neu registrieren',
    register: 'Registrieren',
    loginHeadline: 'Anmeldung',
    closeLogin: 'Anmeldung schließen',
    login: 'Anmelden',
    logout: 'Abmelden',
    loggingIn: 'Anmelden ...',
    loggingOut: 'Abmelden ...',
    goToLogin: 'Zur Anmeldung',
    forgotPassword: 'Passwort vergessen?',
    areYouNew: 'Neu hier?',
    serviceError: {
      title: 'Servicefehler',
      contactSupport: 'Email an Support schicken',
    },
  },
  customerCenter: {
    title: "Kundencenter",
    ariaCloseCustomerCenter: "Kundencenter schließen",
    yourOrders: "Deine Bestellungen",
  },
  search: {
    products: "Produkte",
    categories: "Kategorien",
    manufacturers: "Hersteller",
    closeSearchAria: "Suche schließen",
    retrySearchAria: "Suche nochmals laden",
    inputPlaceholder: "Produkte suchen",
  },
  menus: {
    main: {
      label: "Hauptmenü",
      ariaLabel: "Haupt",
      open: "Menü öffnen",
      close: "Menü schließen",
      all: "Alle",
    },
    footer: {
      ariaLabel: "Fusszeile"
    },
    language: {
      select: "Sprache wählen",
      change: "Sprache ändern"
    }
  },
  footer: {
    contact: "Kontakt",
  },
  user: {
  },
  cart: {
    menu: "Bag",
    cart: "Warenkorb",
    open: "Zum Warenkorb",
    close: "Warenkorb schließen",
    empty: "Dein Warenkorb ist leer.",
    ariaQuantity: "Menge",
    ariaRemoveProduct: "Aus dem Warenkorb löschen",
    removeProduct: "Löschen",
    subtotal: "Zwischensumme",
    tax: "Inkludierte Steuern",
    shipping: "Versand",
    discount: "Ermäßigung",
    total: "Gesamtsumme",
    toCheckout: "Zur Kasse",
    itemsChanged: "Der Warenkorb hat sich geändert",
    productRemoved: "Produkt nicht mehr im Sortiment",
    ariaRemoveVoucher: "Gutschein löschen",
    ariaEnableVoucher: "Gutschein aktivieren",
    ariaDisableVoucher: "Gutschein deaktivieren",
    vouchers: "Gutscheine",
    addVoucher: "Gutschein hinzufügen",
    addVoucherLoading: "Gutschein wird hinzugefügt...",
    counter: {
      decreaseQuantity: "Menge um eins verringern",
      increaseQuantity: "Menge um eins erhöhen",
      manuallySetQuantity: "Menge manuell eingeben",
    }
  },
  orders: {
    empty: "Du hast noch keine Bestellungen gemacht.",
    detailsHeader: "Bestelldetails",
    orderNumber: "Bestellnummer",
    orderDate: "Datum",
    orderStatus: "Status",
  },
  checkout: {
    sections: {
      contact: "Kontakt",
      delivery: "Lieferung",
      payment: "Zahlung",
      shippingMethod: "Versandart",
    },
    voucherPlaceholder: "Gutscheincode eingeben",
  },
  product: {
    description: "Beschreibung",
    allProducts: "Alle Produkte",
    randomProducts: "Zufällige Produkte",
    relatedProducts: "Ähnliche Produkte",
    otherProducts: "Andere Produkte",
    categories: "Kategorien",
    cartButton: {
      addToCart: "In den Warenkorb",
      addedToCart: "Im Warenkorb",
      addToCartShort: "Hinzufügen",
      addedToCartShort: "Hinzugefügt",
    },
    stock: "Verfügbarkeit",
    shippingDuration: "Lieferzeit: 2-3 Werktage"
  },
  products: {
    loop: {
      ariaLabel: "Produkte",
    },
  },
  categories: {
    subCategories: {
      ariaLabel: "Unterkategorien",
    },
    products: "Produkte",
  },
  dynamicPages: {
    products: {
      path: "produkte"
    },
    categories: {
      path: "kategorien"
    },
    blogPosts: {
      path: "blog",
      title: "Blog",
      page: "seite",
      pagination: {
        page: "Seite {{page}}",
      },
    },
    blogPost: {
      path: "blog"
    },
  },
  staticPages: {
    errorPage: {
      title: "Ich kann diese Seite nicht finden!",
      description: "404 - Ich kann diese Seite nicht finden! Bitte versuche, die Startseite zu besuchen. Bitte lass mich wissen, wenn weitere Fehler auftreten!",
      goToHomepage: "Am besten versuchst du es mit der <a href='/{{ url }}/'>Startseite!</a>",
      contactSupport: "Bitte lass mich wissen, wenn weitere Fehler auftreten, damit ich sie korrigieren kann: <a href='mailto:{{ email }}'>{{ email }}</a>"
    },
    userLogin: {
      title: "Anmeldung",
      description: "Benutzer anmelden",
    },
    userRegistration: {
      title: "Registrieren",
      description: "Benutzer registrieren",
      info: "Nach dem Registrieren senden wir Dir per E-Mail einen Link zu, mit dem du deinen Account aktivieren kannst.",
    },
    userRegistrationSuccess: {
      title: "Danke!",
      description: "Danke für's registrieren",
      info: "Du bekommst in Kürze deine Anmeldedaten per E-Mail. In der Zwischenzeit kannst du bei uns online bestellen - der Bestellprozess braucht keinen Login!"
    },
    userConfirm: {
      title: "Benutzerkonto bestätigen",
      description: "Bestätigung des Benutzerkontos",
    },
    userConfirmSuccess: {
      title: "Willkommen!",
      description: "Benutzer erfolgreich bestätigt",
    },
    userRecover: {
      title: "Passwort zurücksetzen",
      description: "Passwort für deinen Account zurücksetzen",
      info: "Bitte gib Deine E-Mail-Adresse an, mit der du dich bei uns registriert hast. Wir senden Dir dann einen Link, mit dem Du ein neues Passwort festlegen kannst."
    },
    userRecoverSuccess: {
      title: "Passwort zurückgesetzt",
      description: "Passwort wurde erfolgreich zurückgesetzt",
    },
    userReset: {
      title: "Passwort ändern",
      description: "Passwort ändern",
    },
    userResetSuccess: {
      title: "Super!",
      description: "Passwort erfolgreich geändert",
    },
    userOrders: {
      title: "Bestellungen",
      description: "Deine Bestellungen",
    },
    orderThankYou: {
      title: "Vielen Dank für Deine Bestellung!",
      description: "Vielen Dank für Deine Bestellung!",
      text: "Deine Bestellung ist bei uns eingegangen und wird nun bearbeitet.",
      submit: {
        text: "Bestellung laden",
        loadingText: "Bestellung wird geladen ...",
      },
    },
    checkout: {
      title: "Bestellung",
      description: "Bestellung bezahlen",
    },
  },
  forms: {
    fields: {
      email: {
        label: "Email",
        errorMessage: "Bitte gib eine gültige E-Mail Adresse ein.",
      },
      password: {
        label: "Passwort",
        errorMessage: "Das Passwort muss mindestens eine Zahl, einen Groß- und Kleinbuchstaben sowie mindestens 8 oder mehr Zeichen enthalten",
        validationChecklist: {
          numbers: "Mindestens eine Zahl",
          length: "8 oder mehr Zeichen",
          letters: "Klein- und Großbuchstaben"
        }
      },
      prename: {
        label: "Vorname",
        errorMessage: "Vorname darf nicht leer sein",
      },
      lastname: {
        label: "Nachname",
        errorMessage: "Nachname darf nicht leer sein",
      },
      street: {
        label: "Straße",
        errorMessage: "Straße darf nicht leer sein",
      },
      streetnumber: {
        label: "Hausnummer",
        errorMessage: "Hausnummer darf nicht leer sein",
      },
      city: {
        label: "Ort/Stadt",
        errorMessage: "Ort/Stadt darf nicht leer sein",
      },
      zip: {
        label: "PLZ",
        errorMessage: "Postleitzahl darf nicht leer sein",
      },
      country: {
        label: "Land",
        errorMessage: "Land darf nicht leer sein",
        none: "Land auswählen",
      },
      registerForNewsletter: {
        label: "Newsletter abonnieren",
      }
    },
    userRegistration: {
      submit: {
        text: "Registrieren",
        loadingText: "Laden ...",
      }
    },
    userRecover: {
      submit: {
        text: "Passwort neu vergeben",
        loadingText: "Laden ...",
      }
    },
    userReset: {
      submit: {
        text: "Passwort zurücksetzen",
        loadingText: "Passwort wird zurückgesetzt ...",
      }
    },
    checkout: {
      submit: {
        text: "Zahlungspflichtig bestellen",
        loadingText: "Laden ...",
      },
      useShippingAsBilling: "Versandadresse auch als Rechnungsadresse verwenden",
    },
  },
  userConfirm: {
    submit: {
      text: "Account bestätigen",
      loadingText: "Account wird bestätigt ...",
    }
  },
  userOrders: {
    submit: {
      text: "Bestellungen laden",
      loadingText: "Bestellungen werden geladen ...",
    }
  },
  confirmUserExpired: {
    headline: 'Sorry!',
    text: 'Der aufgerufene Link ist ungültig. Entweder hast Du Dein Kundenkonto über diesen Link bereits aktiviert oder die Aktivierungsfrist dieses Links ist inzwischen abgelaufen. Um Mißbrauch vorzubeugen, begrenzen wir aus Datenschutzgründen die Gültigkeit von Aktivierungslinks. Du kannst Dir aber jederzeit eine neue E-Mail mit einem gültigen Aktivierungslink zusenden lassen.',
    action: 'Email anfordern'
  },
  userRegistered: {
    text: 'Falls die angegebene Emailadresse bei uns hinterlegt ist, erhälts Du in Kürze eine Email, mit der Du Dein Passwort zurücksetzen kannst.'
  },
  userConfirmed: {
    text: 'Dein Kundenkonto wurde erfolgreich aktiviert. Viel Spass beim Einkaufen!'
  },
  userResetSuccess: {
    text: 'Dein Password wurde erfolgreich geändert. Viel Spass beim Einkaufen!'
  },
  cookies: {
    title: "Cookie Einwilligung",
    close: "Schließen",
    description: "Wir verwenden Cookies, um dein Browsing-Erlebnis zu verbessern, personalisierte Werbung oder Inhalte bereitzustellen und unseren Traffic zu analysieren. Durch Klick auf \"Alle akzeptieren\" stimmst du der Verwendung unserer Cookies zu. Du kannst deine Einstellungen unten verwalten.",
    privacyPolicy: "Datenschutzerklärung",
    essential: {
      title: "Notwendige Cookies",
      required: "Erforderlich",
      description: "Diese Cookies sind notwendig, damit die Website ordnungsgemäß funktioniert und können nicht deaktiviert werden.",
      accessToken: "Speichert dein Authentifizierungstoken für sicheren Login",
      refreshToken: "Erneuert deine Authentifizierung um dich angemeldet zu halten",
      cart: "Behält deinen Warenkorb über Sessions hinweg bei",
      stripe: "Notwendig für sichere Zahlungsabwicklung",
    },
    analytics: {
      title: "Analyse Cookies",
      description: "Wir verwenden Google Analytics, um die Nutzung unserer Website zu analysieren und zu verbessern. Die dabei erhobenen Daten werden anonymisiert verarbeitet. Du kannst die Verwendung von Analytics-Cookies akzeptieren oder ablehnen. Weitere Informationen findest du in unserer {{ privacyPolicy }}.",
      cookiePolicy: "Cookie-Richtlinie",
    },
    marketing: {
      title: "Marketing Cookies",
      description: "Diese Cookies ermöglichen es uns, dir personalisierte Anzeigen zu zeigen und die Leistung von Marketingkampagnen zu verfolgen. Du kannst diese deaktivieren, ohne dass die Website-Funktionalität beeinträchtigt wird.",
    },
    actions: {
      rejectAll: "Alle ablehnen",
      acceptAll: "Alle akzeptieren",
      savePreferences: "Einstellungen speichern",
      settings: "Einstellungen",
    },
    editButton: "Cookies",
    settings: {
      title: "Cookie-Einstellungen",
    }
  },
};
