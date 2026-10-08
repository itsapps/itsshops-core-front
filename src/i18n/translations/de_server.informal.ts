// Informal ("Du") overlay for de_server.ts — applied when SHOP_FORMALITY=informal.
// Only keys whose text differs from the formal base; same nesting.
export default {
  api: {
    errors: {
      validation: {
        name: "Bitte gib Deinen Namen ein.",
      },
      auth: {
        maybeNotConfirmed: "Login fehlgeschlagen. Falls Du deine Registrierung noch nicht bestätigt hast, solltest Du in Kürze eine E-Mail bekommen.",
      },
      order: {
        withdrawFailed: "Der Widerruf konnte nicht verarbeitet werden. Bitte versuche es später erneut.",
      },
    },
  },
  emails: {
    order: {
      withdrawalText: "Du kannst diese Bestellung innerhalb von 14 Tagen ohne Angabe von Gründen widerrufen.",
    },
    orderConfirmation: {
      preview: "Danke für Deinen Einkauf!",
      text: "Vielen Dank für Deinen Einkauf. Deine Bestellung ist bei uns eingegangen und wird in Kürze bearbeitet.",
    },
    orderProcessing: {
      preview: "Deine Bestellung wird nun bearbeitet.",
      text: "Vielen Dank für Deinen Einkauf. Deine Bestellung wird nun bearbeitet und in Kürze versendet.",
    },
    orderInvoice: {
      preview: "Deine Rechnung als PDF im Anhang",
      text: "Hier ist Deine Rechnung als PDF im Anhang. Vielen Dank für Deinen Einkauf!",
    },
    orderShipping: {
      preview: "Es wird nicht mehr lange dauern, bis Du Deine Bestellung in den Händen hast!",
      text: "Wir freuen uns, Dir mitteilen zu können, daß Deine Bestellung unterwegs ist. Du wirst die Lieferung schon bald in Deinen Händen halten.",
    },
    orderDelivered: {
      preview: "Deine Bestellung ist angekommen!",
      text: "Vielen Dank für den Einkauf und viel Spass mit deinen neuen Produkten!",
    },
    orderReturned: {
      preview: "Deine Rücksendung ist bei uns eingegangen.",
      text: "Deine Rücksendung ist bei uns eingegangen – vielen Dank! Wir prüfen die Ware und kümmern uns um die weitere Abwicklung.\nSofern eine Rückerstattung ansteht, erhältst Du diese in Kürze über das ursprünglich verwendete Zahlungsmittel.",
    },
    orderCanceled: {
      preview: "Deine Bestellung wurde storniert.",
      text: "Deine Bestellung wurde storniert. Falls Du bereits bezahlt hast, erstatten wir Dir den Betrag in voller Höhe über das ursprünglich verwendete Zahlungsmittel zurück.\nSolltest Du Fragen haben, melde Dich gerne jederzeit bei uns.",
    },
    orderRefunded: {
      preview: "Wir haben Deine Zahlung zurückerstattet.",
      text: "Wir haben Dir {{amount}} in voller Höhe zurückerstattet. Die Gutschrift erfolgt über das ursprünglich verwendete Zahlungsmittel.\nJe nach Bank oder Kartenanbieter kann es einige Werktage dauern, bis der Betrag wieder auf Deinem Konto sichtbar ist. Bei Fragen kannst Du Dich jederzeit bei uns melden.",
    },
    orderRefundedPartially: {
      preview: "Wir haben einen Teil Deiner Zahlung zurückerstattet.",
      text: "Wir haben Dir einen Teilbetrag von {{amount}} zurückerstattet. Die Gutschrift erfolgt über das ursprünglich verwendete Zahlungsmittel.\nJe nach Bank oder Kartenanbieter kann es einige Werktage dauern, bis der Betrag auf Deinem Konto sichtbar ist. Bei Fragen zur Rückerstattung kannst Du Dich gerne bei uns melden.",
    },
    newsletterConfirmation: {
      subject: "Bitte bestätige Deine Newsletter-Anmeldung 📩",
      text: "Bitte bestätige mit einem Klick, dass Du unseren Newsletter erhalten möchtest. Wenn Du Dich nicht angemeldet hast, kannst Du diese E-Mail einfach ignorieren.",
    },
    userConfirmation: {
      headline: "Hi!",
      text: "Bitte folge dem Link, um Dein Kundenkonto zu bestätigen.",
    },
    userInvitation: {
      subject: "Du bist eingeladen! 🎉",
      preview: "Du bist eingeladen, unserem Webshop beizutreten",
      text: "Du bist eingeladen, unserem Webshop beizutreten. Klicke auf den folgenden Link, um Dein Passwort zu setzen und loszulegen.",
    },
    userReset: {
      headline: "Hi!",
      text: "Bitte folge dem Link, um ein neues Passwort für Dein Kundenkonto zu setzen.",
    },
    orderWithdrawalCustomer: {
      preview: "Wir haben Deinen Widerruf erhalten.",
      intro: "wir bestätigen den Eingang Deiner Widerrufserklärung. Folgende Angaben haben wir am {{date}} erhalten:",
      unmatched: "Wir konnten Deine Angaben nicht automatisch einer Bestellung zuordnen. Wir prüfen Deine Erklärung und melden uns bei Dir.",
      returnInstructions: "Bitte sende die Ware innerhalb von 14 Tagen zurück an: {{address}}.",
      returnCost: {
        customer: "Bitte beachte, dass die unmittelbaren Kosten der Rücksendung von Dir zu tragen sind.",
        merchant: "Die Kosten der Rücksendung übernehmen wir gerne für Dich.",
      },
      diminishedValue: "Für einen etwaigen Wertverlust der Ware haftest Du nur, wenn dieser auf einen nicht notwendigen Umgang zur Prüfung der Beschaffenheit und Funktionsweise zurückzuführen ist.",
      notDispatched: "Da Deine Bestellung noch nicht versendet wurde, stornieren wir sie und erstatten alle erhaltenen Zahlungen innerhalb von 14 Tagen über das ursprünglich verwendete Zahlungsmittel. Du musst nichts zurücksenden.",
    },
  },
}

