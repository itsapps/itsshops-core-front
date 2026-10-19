export default {
  navigation: {
    goHome: "Go to Homepage",
    ariaGoHome: "Go to Homepage",
    mainMenu: "Main menu",
    openMainMenu: "Main menu",
    ariaOpenMainMenu: "Open main menu",
    closeMainMenu: "Close",
    ariaCloseMainMenu: "Close main menu",
    openSubmenu: "Submenu",
    ariaOpenSubmenu: "Open submenu",
    openCart: "Cart",
    ariaOpenCart: "Go to cart",
  },
  language: {
    select: "Select language",
    ariaSelect: "Select language",
    change: "Change language",
    ariaChange: "Change language",
    names: {
      de: "Deutsch",
      en: "English",
    },
  },
  skipLink: {
    title: 'Skip to main content',
  },
  cart: {
    ariaMain: "Shopping cart",
    title: "Shopping cart",
    close: "Close",
    ariaClose: "Close shopping cart",
    empty: "Your cart is empty.",
    subtotal: "Subtotal",
    subtotalNote: "Incl. VAT, plus shipping – calculated at checkout.",
    removeProduct: "Remove",
    ariaRemoveProduct: "Remove from cart",
    counter: {
      decreaseQuantity: "Decrease quantity by one",
      increaseQuantity: "Increase quantity by one",
      quantity: "Quantity",
      manuallySetQuantity: "Manually enter quantity",
    },
    toCheckout: "Proceed to checkout",

    // ariaQuantity: "Quantity",
    // tax: "Tax included",
    // shipping: "Shipping",
    // discount: "Discount",
    // itemsChanged: "The cart has changed",
    // productRemoved: "Product no longer available",
    // ariaRemoveVoucher: "Remove voucher",
    // ariaEnableVoucher: "Enable voucher",
    // ariaDisableVoucher: "Disable voucher",
    // vouchers: "Vouchers",
    // addVoucher: "Add voucher",
    // addVoucherLoading: "Adding voucher...",

  },
  product: {
    taxShippingInfoText: "Incl. VAT / Excl. shipping costs",
    cartButton: {
      addToCart: "Add to cart",
      addedToCart: "In cart",
      addToCartShort: "Add",
      addedToCartShort: "Added",
      ariaAddToCart: "Add {qty} {title} to cart",
    },
    states: {
      active:  "Available",
      comingSoon: "Coming soon",
      soldOut:   "Sold out",
      archived:  "Unavailable",
    },
    price: {
      was: "Was",
    },
    variants: "Variants",
    ariaVariants: "Product variants",
    wine: {
      volume:          "Volume",
      vintage:         "Vintage",
      color:           "Colour",
      type:            "Type",
      alcohol:         "Alcohol",
      tartaricAcid:    "Total acidity",
      freeSulfur:      "Free sulphur",
      residualSugar:   "Residual Sugar",
      totalSulfur:     "Total sulphur",
      phValue:         "pH value",
      histamine:       "Histamine",
      varietals:       "Grape variety",
      classifications: "Classification",
      qualityGrades:   "Quality grade",
      certificates:    "Certificates",
      terroir:         "Region",
      soils:           "Soil",
      awards:          "Awards",
      factsheet:      'Factsheet',
      elabel:          "Nutrition Information",
    },
    allProducts: "All products",

    // description: "Description",
    // randomProducts: "Random products",
    // relatedProducts: "Related products",
    // otherProducts: "Other products",
    // categories: "Categories",
    // stock: "Availability",
    // shippingDuration: "Delivery time: 2-3 business days",
  },
  filters: {
    vintage: "Vintage",
    varietal: "Grape variety",
    color: "Colour",
    flavor: "Taste",
    classification: "Classification",
    qualityGrade: "Quality grade",
    volume: "Bottle size",
    price: "Price",
    priceMin: "Minimum price",
    priceMax: "Maximum price",
    category: "Category",
    label: "Filter",
    reset: "Reset filters",
    close: "Close filters",
    showResults: "Show results",
    results: "{count} products",
  },
  gallery: {
    thumbnail: "Image",
    carousel: "Image gallery",
    slide: "Slide",
    pause: "Pause autoplay",
    play: "Resume autoplay",
    view: "View gallery",
    close: "Close",
    previous: "Previous image",
    next: "Next image",
    download: "Download",
  },
  categories: {
    title: "Shop-Categories",
    ariaTitle: "Shop-Categories",
  },
  products: {
    title: "Products",
    ariaTitle: "Products",
    view: {
      list: 'List',
      grid: 'Grid',
    },
  },

  // general: {
  //   retry: "Try again",
  //   back: 'Back',
  //   skipText: 'Skip to main content',
  //   toc: 'Table of contents',
  //   skipToc: 'Skip table of contents',
  //   isLoading: 'Loading',
  //   registerNew: 'Register new',
  //   register: 'Register',
  //   loginHeadline: 'Login',
  //   closeLogin: 'Close login',
  //   login: 'Log in',
  //   logout: 'Log out',
  //   loggingIn: 'Logging in ...',
  //   loggingOut: 'Logging out ...',
  //   goToLogin: 'Go to login',
  //   forgotPassword: 'Forgot password?',
  //   areYouNew: 'New here?',
  //   serviceError: {
  //     title: 'Service error',
  //     contactSupport: 'Email support',
  //   },
  // },
  // customerCenter: {
  //   title: "Customer centre",
  //   ariaCloseCustomerCenter: "Close customer centre",
  //   yourOrders: "Your orders",
  // },
  search: {
    placeholder: "Search...",
    noResults: "No results",
    close: "Close search",
  },
  // footer: {
  //   contact: "Contact",
  // },
  // user: {
  // },
  // orders: {
  //   empty: "You haven't placed any orders yet.",
  //   detailsHeader: "Order details",
  //   orderNumber: "Order number",
  //   orderDate: "Date",
  //   orderStatus: "Status",
  // },
  checkout: {
    shippingInfo: 'Delivery countries, shipping costs and payment methods: <a href="{{url}}">Shipping & payment</a>',
    confirmations: {
      terms: 'I have read the <a href="{{url}}">Terms & Conditions</a> and agree to them.',
      withdrawalPolicy: 'I have read the <a href="{{url}}">withdrawal policy</a>.',
      age: "I confirm that I am at least 18 years old.",
    },
    sections: {
      contact: "Contact",
      delivery: "Delivery",
      billing: "Billing address",
      payment: "Payment",
      shippingMethod: "Shipping method",
      summary: "Summary",
      coupon: "Coupon code",
    },
    subtotal: "Subtotal",
    shipping: "Shipping",
    total: "Total",
    vat: "VAT",
    vatExempt: "VAT exempt",
    freeShipping: "Free shipping",
    cartEmpty: "Your cart is empty.",
    loading: "Loading...",
    error: "An error occurred. Please try again.",
    serviceError: "A technical error occurred. Please try again later or contact support.",
    serviceErrorContact: "Contact support",
    itemsUnavailable: "Some items are no longer available and have been removed.",
    available: "available",
    orDivider: "or",
    discount: "Discount",
    coupon: {
      label: "Coupon code",
      placeholder: "Enter code",
      apply: "Apply",
      remove: "Remove",
      applied: "Applied",
      error: {
        fallback: "Could not apply coupon",
        notFound: "Coupon code not found",
        disabled: "This coupon is no longer active",
        expired: "This coupon has expired",
        notYet: "This coupon is not yet valid",
        exhausted: "This coupon has reached its redemption limit",
        belowMinimum: "Cart total is below the coupon's minimum",
      },
    },
  },
  ageGate: {
    title:       "Are you at least {{age}} years old?",
    text:        "To enter this shop you must have reached the legal minimum age for buying alcohol.",
    confirm:     "Yes, I'm at least {{age}}",
    deny:        "No, I'm younger",
    note:        "By confirming you accept that we store your age confirmation locally in your browser.",
    deniedText:  "You must be at least {{age}} years old to use this shop.",
  },
  staticPages: {
    errorPage: {
      title: "I can't find this page!",
      description: "404 - I can't find this page! Please try visiting the homepage. Please let me know if further errors occur!",
      goToHomepage: "Your best bet is to try the <a href='/{{ url }}/'>homepage!</a>",
      contactSupport: "Please let me know if further errors occur so I can fix them: <a href='mailto:{{ email }}'>{{ email }}</a>"
    },
    userLogin: {
      title: "Login",
      description: "User login",
    },
    userRegistration: {
      title: "Registration",
      description: "User registration",
      info: "After registering, we will send you an email with a link to activate your account.",
    },
    userRegistrationSuccess: {
      title: "Thank you!",
      description: "Thanks for registering",
      info: "You will receive an email shortly to activate your account.",
    },
    userConfirm: {
      title: "Confirm account",
      description: "Account confirmation",
    },
    userConfirmSuccess: {
      title: "Welcome!",
      description: "User successfully confirmed",
      info: "Your account has been successfully activated. Enjoy shopping!",
    },
    userRecover: {
      title: "Reset password",
      description: "Reset your account password",
      info: "Please enter the email address you used to register with us. We will then send you a link to set a new password."
    },
    userRecoverSuccess: {
      title: "Password reset",
      description: "Password has been successfully reset",
      info: "You will receive an email shortly with a link to reset your password.",
    },
    userReset: {
      title: "Change password",
      description: "Change password",
    },
    userResetSuccess: {
      title: "Great!",
      description: "Password successfully changed",
      info: "Your password has been successfully changed.",
    },
    newsletterConfirm: {
      title: "Confirm newsletter",
      description: "Confirm newsletter subscription",
      info: "Please confirm with one click that you'd like to receive our newsletter.",
    },
    newsletterConfirmSuccess: {
      title: "Subscription confirmed!",
      description: "Newsletter subscription confirmed",
      info: "Thank you! You'll receive our newsletter from now on.",
    },
    newsletterUnsubscribe: {
      title: "Unsubscribe from newsletter",
      description: "Unsubscribe from the newsletter",
      info: "Sorry to see you go. Click below to unsubscribe from our newsletter.",
    },
    newsletterUnsubscribeSuccess: {
      title: "Unsubscribed",
      description: "Successfully unsubscribed from the newsletter",
      info: "You've been unsubscribed from our newsletter and won't receive any further emails.",
    },
    userOrders: {
      title: "Orders",
      description: "Your orders",
    },
    orderThankYou: {
      title: "Order complete",
      description: "Thank you for your order!",
      heading: "Thank you for your order!",
      headingNamed: "Thank you for your order, {{name}}!",
      text: "You'll receive a confirmation by email once your order has been received.",
      succeeded: "Your order has been received. You'll receive a confirmation with your order number by email.",
      succeededEmail: "Your order has been received. A confirmation with your order number is on its way to {{email}}.",
      processing: "Your payment is still being processed. Once it has arrived, you'll receive a confirmation by email – this can take a few business days.",
      processingEmail: "Your payment is still being processed. Once it has arrived, you'll receive a confirmation at {{email}} – this can take a few business days.",
      summary: "Your order",
      orderNumber: "Order number",
      delivery: "Delivery",
      nextStepsTitle: "What happens next?",
      nextSteps: "As soon as your order ships, we'll send you a shipping confirmation by email.",
      nextStepsAgeRestricted: "Please note: we only deliver to persons aged 18 or over. Proof of age may be requested on delivery.",
      withdraw: "Withdraw from contract here",
    },
    checkout: {
      title: "Checkout",
      description: "Pay for order",
    },
    orderWithdraw: {
      title: "Withdraw from contract here",
      description: "Declare withdrawal from a contract",
      info: "You may withdraw from your order within 14 days. Please enter your name, your order number and the email address used for the order.",
    },
    orderWithdrawSuccess: {
      title: "Withdrawal received",
      description: "We have received your withdrawal",
      info: "We have received your withdrawal and sent you a confirmation by email.",
    },
  },
  forms: {
    errors: {
      service: "A technical error occurred. Please try again later.",
      rateLimited: "Too many requests. Please try again in a minute.",
    },
    fields: {
      email: {
        label: "Email",
        errorMessage: "Please enter a valid email address.",
      },
      password: {
        label: "Password",
        errorMessage: "The password must contain at least one number, one uppercase and one lowercase letter, and at least 8 or more characters",
        validationChecklist: {
          numbers: "At least one number",
          length: "8 or more characters",
          letters: "Uppercase and lowercase letters"
        }
      },
      prename: {
        label: "First name",
        errorMessage: "First name must not be empty",
      },
      lastname: {
        label: "Last name",
        errorMessage: "Last name must not be empty",
      },
      street: {
        label: "Street",
        errorMessage: "Street must not be empty",
      },
      streetnumber: {
        label: "House number",
        errorMessage: "House number must not be empty",
      },
      line2: {
        label: "Address line 2 (optional)",
      },
      state: {
        label: "State / Region (optional)",
      },
      city: {
        label: "City/Town",
        errorMessage: "City/Town must not be empty",
      },
      zip: {
        label: "Postal code",
        errorMessage: "Postal code must not be empty",
        errorMessageFormat: "Invalid postal code",
      },
      country: {
        label: "Country",
        errorMessage: "Country must not be empty",
        none: "Select country",
      },
      phone: {
        label: "Phone",
        errorMessage: "Phone number must not be empty",
      },
      name: {
        label: "Name",
        errorMessage: "Please enter your name.",
        errorMessageNoLinks: "Please do not enter links or web addresses (100 characters max).",
      },
      website: {
        label: "Website (please leave empty)",
      },
      orderNumber: {
        label: "Order number",
        errorMessage: "Please enter your order number.",
      },
      reason: {
        label: "Reason / affected items (optional)",
      },
      registerForNewsletter: {
        label: "Subscribe to newsletter",
        privacyNotice: 'By subscribing you agree to our <a href="{{url}}">privacy policy</a>.',
      },
      captcha: {
        errorMessage: "Please solve the captcha to continue.",
      }
    },
    userLogin: {
      submit: {
        text: "Sign in",
        loadingText: "Signing in ...",
      }
    },
    userRegistration: {
      submit: {
        text: "Register",
        loadingText: "Loading ...",
      }
    },
    userRecover: {
      submit: {
        text: "Reset password",
        loadingText: "Loading ...",
      }
    },
    orderWithdraw: {
      submit: {
        text: "Confirm withdrawal",
        loadingText: "Sending ...",
      }
    },
    userReset: {
      submit: {
        text: "Save password",
        loadingText: "Saving password ...",
      }
    },
    checkout: {
      submit: {
        text: "Place binding order",
        loadingText: "Loading ...",
      },
      useShippingAsBilling: "Use shipping address as billing address",
    },
    userConfirm: {
      submit: {
        text: "Confirm account",
        loadingText: "Confirming account ...",
      }
    },
    newsletter: {
      trigger: "Subscribe to newsletter",
      close: "Close",
      intro: "Stay in the loop and subscribe to our newsletter.",
      privacyNotice: 'By subscribing you agree to our <a href="{{url}}">privacy policy</a>. You can unsubscribe at any time.',
      successNotice: "Almost done! If you're not already subscribed, you'll receive an email shortly with a confirmation link.",
      submit: {
        text: "Subscribe",
        loadingText: "Sending ...",
      }
    },
    newsletterConfirm: {
      submit: {
        text: "Confirm subscription",
        loadingText: "Confirming ...",
      }
    },
    newsletterUnsubscribe: {
      submit: {
        text: "Confirm unsubscribe",
        loadingText: "Unsubscribing ...",
      }
    },
    userOrders: {
      submit: {
        text: "Load orders",
        loadingText: "Loading orders ...",
      }
    },
  },
  shippingInfo: {
    paymentHeading: "Payment",
    shippingHeading: "Shipping",
    type: "Type",
    types: { delivery: "Delivery", pickup: "Pickup" },
    deliveryTime: "Delivery time",
    countries: "Delivery countries",
    pickupFee: "Fee",
    free: "free",
    freeShipping: "Free shipping",
    freeShippingFrom: "from an order value of {{amount}}",
    packagingCaption: "Shipping costs for wine ({{volume}} bottles), per case",
    packagingShared: "{{count}} bottles of {{volume}} count as one bottle.",
    package: "Case",
    packageCount_one: "for {{count}} bottle",
    packageCount_other: "for {{count}} bottles",
    ratesCaption: "Shipping costs by weight",
    ratesCaptionOther: "Shipping costs for other items by weight",
    weight: "Weight",
    price: "Price",
    upTo: "up to {{weight}} kg",
    anyWeight: "any weight",
    pricesGross: "All prices incl. VAT.",
    legalGuarantee: "Legal guarantee",
  },
  // Generated privacy policy (privacyPolicyModule, shared/privacy-policy.ts). Art. 13 GDPR; one
  // block per processing, rendered only when the shop runs it. {{provider}} = linked provider name.
  privacyPolicy: {
    missing: "Privacy policy cannot be generated – missing settings: {{fields}}. (Only visible in preview.)",
    updated: "Last updated: {{date}}",
    controller: {
      heading: "Controller",
      text: "The controller responsible for processing your personal data on this website is {{company}}, {{address}}, email: {{email}}. If you have any questions about data protection, please contact us at this address.",
      dpo: "You can reach our data protection officer at: {{dpo}}",
    },
    overview: {
      heading: "Overview",
      textShop: "We only process the data needed to run this website and – if you place an order – to process your order. We do not use analytics or tracking tools, advertising cookies or social media plugins. Below we explain which data we process for which purpose, who receives it and how long we keep it.",
      text: "We only process the data needed to run this website. We do not use analytics or tracking tools, advertising cookies or social media plugins. Below we explain which data we process for which purpose, who receives it and how long we keep it.",
    },
    hosting: {
      heading: "Hosting and server logs",
      text: "This website is hosted by {{provider}}. Each time a page is requested, Netlify processes technically necessary data: IP address, date and time, requested address, referrer and browser identifier (user agent). This is needed to deliver the website, keep it secure (e.g. defending against attacks, limiting requests per IP address) and find errors. The legal basis is our legitimate interest in secure and stable operation (Art. 6(1)(f) GDPR).",
      retention: "Access logs are kept for at most 30 days, logs of our server functions for at most 7 days; these contain no names, addresses or email addresses. Netlify processes the data as our processor in the USA; the transfer is covered by the European Commission's adequacy decision for the EU-US Data Privacy Framework, in which Netlify participates.",
    },
    content: {
      heading: "Content and images",
      text: "We manage the content of this website with {{provider}}. Images are loaded directly from Sanity's image server (cdn.sanity.io), which receives your IP address and browser identifier. The legal basis is our legitimate interest in delivering images quickly and reliably (Art. 6(1)(f) GDPR). Sanity processes the data as our processor, including in the USA; the transfer is covered by the EU Standard Contractual Clauses.",
    },
    orders: {
      heading: "Orders",
      text: "When you place an order, we process your name, email address, billing and shipping address, the items ordered and the payment status in order to perform the contract (Art. 6(1)(b) GDPR) and to meet our statutory retention obligations (Art. 6(1)(c) GDPR). Order data is stored with {{provider}} (processor). We keep orders for seven years from the end of the calendar year (§ 132 BAO). Data from a checkout that was started but not paid is deleted after {{days}} days.",
      carrier: "To ship your order, we pass your name and shipping address to the parcel service we use, which processes them as an independent controller (Art. 6(1)(b) GDPR). We do not pass on your email address.",
    },
    payment: {
      heading: "Payment",
      text: "Payments are processed by {{provider}} (Stripe Payments Europe Ltd., Ireland). Stripe receives the payment details you enter in the payment form as well as your name, email address, the amount, IP address and device information. We never see full card or account details. The legal basis is the performance of the contract (Art. 6(1)(b) GDPR).",
      fraud: "To prevent fraud, Stripe screens payments automatically and processes data for this and to meet its own legal obligations as an independent controller (Art. 6(1)(c) and (f) GDPR). Stripe may transfer data to Stripe, Inc. in the USA (EU-US Data Privacy Framework). On the checkout page Stripe sets the cookies __stripe_mid and __stripe_sid for fraud detection; they are strictly necessary for a secure payment. How long Stripe keeps data is set out in Stripe's privacy policy.",
      wallets: "If you pay with Apple Pay or Google Pay, Apple or Google also process payment data under their own privacy policies.",
    },
    email: {
      heading: "Email delivery",
      text: "We send emails such as order confirmations, shipping updates and – where used – account or newsletter confirmations via {{provider}}. The service receives your email address and the content of the email. The legal basis is the performance of the contract (Art. 6(1)(b) GDPR) or, for the newsletter, your consent.",
      resend: "The service is our processor; data is processed in the USA (EU-US Data Privacy Framework). Delivery logs are kept by the service for a limited time only.",
      mailgunEu: "The service is our processor; data is processed in the EU. Delivery logs are kept by the service for a limited time only.",
      mailgunUs: "The service is our processor; data is processed in the USA (EU Standard Contractual Clauses). Delivery logs are kept by the service for a limited time only.",
    },
    withdrawal: {
      heading: "Online withdrawal",
      text: "If you withdraw from the contract using our form, we process the order number, your email address, your declaration and its time in order to handle the withdrawal and confirm receipt to you (Art. 6(1)(c) GDPR in conjunction with the Austrian FAGG). We keep this data together with the order.",
    },
    orderSystem: {
      heading: "Order management and invoicing",
      text: "For invoicing, accounting and shipping, our merchandise management system wineNET reads the order data (name, email address, addresses, items, amounts). The provider, {{provider}}, Reitschulgasse 19, 7093 Jois, Austria, processes the data on our behalf as our processor. The legal basis is the performance of the contract and our legal obligations (Art. 6(1)(b) and (c) GDPR).",
    },
    account: {
      heading: "Customer account",
      text: "If you create a customer account, we store your email address, your name and the details from the registration form so that you can sign in and manage your data (Art. 6(1)(b) GDPR). Sign-in and accounts are managed with {{provider}} (processor; transfers to the USA based on the EU Standard Contractual Clauses). For signing in we set the cookies sb_access_token and sb_refresh_token; they are strictly necessary for this. We delete your account and this data when you ask us to delete the account; orders are kept for the statutory retention period.",
    },
    newsletter: {
      heading: "Newsletter",
      text: "If you subscribe to our newsletter, we store your email address based on your consent (Art. 6(1)(a) GDPR). The subscription only takes effect once you click the link in our confirmation email (double opt-in); for this we store a confirmation code and the time. You can withdraw your consent at any time – via the unsubscribe link in every newsletter or by emailing us. We then remove your address from the list. The data is stored with {{provider}}; emails are sent via the service named under \"Email delivery\".",
    },
    captcha: {
      heading: "Spam protection",
      text: "To protect forms ({{forms}}) from automated abuse, we use {{provider}} (Intuition Machines, Inc., USA). hCaptcha receives your IP address and characteristics of your browser and device to check whether the input comes from a human. hCaptcha is only loaded when such a form is shown. The legal basis is our legitimate interest in protection against spam and abuse (Art. 6(1)(f) GDPR). The transfer to the USA is covered by the EU-US Data Privacy Framework.",
      forms: { register: "registration", recover: "forgotten password", newsletter: "newsletter" },
    },
    vinofact: {
      heading: "Embedded content",
      text: "On product pages we show wine images (e.g. bottle photos) from vinofact, loaded directly from its server (i.vinofact.com). The provider receives your IP address and browser identifier. The legal basis is our legitimate interest in complete product information (Art. 6(1)(f) GDPR). The provider is {{provider}}, Dr. Hoyosstraße 12, 4311 Schwertberg, Austria.",
    },
    storage: {
      heading: "Cookies and browser storage",
      intro: "We do not use cookies for analytics or advertising. We only store what is strictly necessary for the features you use; no consent is required for this (§ 165(3) Austrian TKG 2021). The data stays in your browser and is not sent to us:",
      items: {
        cart: "cart and any coupon code entered,",
        pendingPayment: "a marker for a payment in progress, so the cart can be cleared afterwards,",
        orderSnapshot: "a summary of your order for the confirmation page – only until you close the tab,",
        ageGate: "your confirmation of the minimum age,",
        search: "your recent searches.",
      },
      outro: "You can delete this data at any time in your browser settings.",
      outroCookies: "You can delete this data at any time in your browser settings. Cookies for payment and the customer account are described in the respective sections.",
      none: "We do not set any cookies or store any data in your browser.",
      noneCookies: "We do not use cookies for analytics or advertising. Cookies and browser data for the customer account are described in the respective section.",
    },
    required: {
      heading: "Required data",
      text: "To place an order we need your name, billing and shipping address and your email address; without them we cannot conclude or perform the contract. Other fields are optional.",
    },
    automated: {
      heading: "Automated decisions",
      text: "We do not make decisions based solely on automated processing and do not create profiles.",
      stripe: "Stripe screens payments automatically for fraud and may decline a payment (see \"Payment\"); in that case, please contact us.",
    },
    rights: {
      heading: "Your rights",
      text: "You have the right to access the data we hold about you (Art. 15 GDPR), to rectification (Art. 16), erasure (Art. 17), restriction of processing (Art. 18) and data portability (Art. 20). Where we process data based on our legitimate interest, you may object (Art. 21). You can withdraw consent at any time with effect for the future. To do so, contact {{email}}.",
    },
    complaint: {
      heading: "Complaint",
      text: "If you believe that we are not processing your data lawfully, you can lodge a complaint with a supervisory authority. In Austria this is the Datenschutzbehörde (Data Protection Authority), Barichgasse 40–42, 1030 Vienna, {{dsb}}.",
    },
  },
  withdrawalInstructions: {
    missing: "Withdrawal instructions can't be generated – missing settings: {{fields}}. (Visible in preview only.)",
  },
  // Harmonised notice on the statutory warranty (FAGG Anhang II / Reg. (EU) 2025/1960) — official
  // wording, not editable: no informal variant.
  legalGuarantee: {
    // URL fragment of the full notice on the "Shipping & payment" page (id + checkout link)
    anchor: "legal-guarantee",
    compact: "Minimum two-year legal guarantee – learn more",
    alt: "Legal guarantee – harmonised EU notice",
    text: "<p><strong>Legal guarantee</strong></p><p><strong>Minimum two-year legal guarantee protection</strong> for goods sold in the European Union.</p><p>Consumers can claim their rights under the legal guarantee of conformity, for example if goods:</p><ul><li>do not match the description;</li><li>do not function as intended.</li></ul><p><strong>Sellers are liable</strong> for any lack of conformity which existed when the goods were delivered, and which becomes apparent within the legal guarantee period. Sellers in such a situation are required to offer:</p><ul><li><strong>free repair</strong> or <strong>free replacement</strong>;</li><li>in some cases, a <strong>price reduction</strong> or <strong>full reimbursement</strong>.</li></ul><p>Some countries have a longer legal guarantee period. For second-hand goods, a shorter period may apply, but not less than one year.</p><p>For more information on your rights in a specific country, scan the QR code below or ask the seller: <a href=\"https://europa.eu/youreurope/guarantees\">europa.eu/youreurope/guarantees</a></p><p><strong>What to do if you receive non-conforming goods:</strong></p><ol><li>Contact the seller as soon as possible to report the issue;</li><li>Provide proof of purchase, such as a receipt, invoice, or bank statement.</li></ol><p>Sellers and producers may also offer commercial guarantees, which apply independently from the legal guarantee. For example, you may see this GARAN label representing a <strong>commercial guarantee of durability</strong> offered by the producer at no additional cost and covering the entire good.</p>",
  },
  cookies: {
    title: "Cookie consent",
    close: "Close",
    description: "We use cookies to improve your browsing experience, provide personalised advertising or content, and analyse our traffic. By clicking \"Accept all\", you consent to our use of cookies. You can manage your preferences below.",
    privacyPolicy: "Privacy policy",
    essential: {
      title: "Essential cookies",
      required: "Required",
      description: "These cookies are necessary for the website to function properly and cannot be disabled.",
      accessToken: "Stores your authentication token for secure login",
      refreshToken: "Renews your authentication to keep you logged in",
      cart: "Keeps your shopping cart across sessions",
      stripe: "Required for secure payment processing",
    },
    analytics: {
      title: "Analytics cookies",
      description: "We use Google Analytics to analyse and improve the use of our website. The data collected is processed anonymously. You can accept or decline the use of analytics cookies. More information can be found in our {{ privacyPolicy }}.",
      cookiePolicy: "Cookie policy",
    },
    marketing: {
      title: "Marketing cookies",
      description: "These cookies allow us to show you personalised ads and track the performance of marketing campaigns. You can disable these without affecting website functionality.",
    },
    actions: {
      rejectAll: "Reject all",
      acceptAll: "Accept all",
      savePreferences: "Save preferences",
      settings: "Settings",
    },
    editButton: "Cookies",
    settings: {
      title: "Cookie settings",
    }
  },
};
