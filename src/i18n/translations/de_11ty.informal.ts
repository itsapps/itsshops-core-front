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
}

