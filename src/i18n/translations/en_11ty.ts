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
    total: "Total",
    removeProduct: "Remove",
    ariaRemoveProduct: "Remove from cart",
    counter: {
      decreaseQuantity: "Decrease quantity by one",
      increaseQuantity: "Increase quantity by one",
      manuallySetQuantity: "Manually enter quantity",
    },
    toCheckout: "Proceed to checkout",

    // ariaQuantity: "Quantity",
    // subtotal: "Subtotal",
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
      totalSulfur:     "Total sulphur",
      phValue:         "pH value",
      histamine:       "Histamine",
      varietals:       "Grape variety",
      classifications: "Classification",
      terroir:         "Region",
      soils:           "Soil",
      awards:          "Awards",
      factsheet: {
        pdfUrl: "Factsheet (PDF)",
      },
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
    classification: "Classification",
    reset: "Reset filters",
    showResults: "Show results",
    results: "{count} products",
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
  // search: {
  //   products: "Products",
  //   categories: "Categories",
  //   manufacturers: "Manufacturers",
  //   closeSearchAria: "Close search",
  //   retrySearchAria: "Reload search",
  //   inputPlaceholder: "Search products",
  // },
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
  // checkout: {
  //   sections: {
  //     contact: "Contact",
  //     delivery: "Delivery",
  //     payment: "Payment",
  //     shippingMethod: "Shipping method",
  //   },
  //   voucherPlaceholder: "Enter voucher code",
  // },
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
      title: "Register",
      description: "User registration",
      info: "After registering, we will send you an email with a link to activate your account.",
    },
    userRegistrationSuccess: {
      title: "Thank you!",
      description: "Thanks for registering",
      info: "You will receive your login details by email shortly. In the meantime, you can order online from us — the ordering process does not require a login!"
    },
    userConfirm: {
      title: "Confirm account",
      description: "Account confirmation",
    },
    userConfirmSuccess: {
      title: "Welcome!",
      description: "User successfully confirmed",
    },
    userRecover: {
      title: "Reset password",
      description: "Reset your account password",
      info: "Please enter the email address you used to register with us. We will then send you a link to set a new password."
    },
    userRecoverSuccess: {
      title: "Password reset",
      description: "Password has been successfully reset",
    },
    userReset: {
      title: "Change password",
      description: "Change password",
    },
    userResetSuccess: {
      title: "Great!",
      description: "Password successfully changed",
    },
    userOrders: {
      title: "Orders",
      description: "Your orders",
    },
    orderThankYou: {
      title: "Thank you for your order!",
      description: "Thank you for your order!",
      text: "Your order has been received and is now being processed.",
      submit: {
        text: "Load order",
        loadingText: "Loading order ...",
      },
    },
    checkout: {
      title: "Order",
      description: "Pay for order",
    },
  },
  forms: {
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
      city: {
        label: "City/Town",
        errorMessage: "City/Town must not be empty",
      },
      zip: {
        label: "Postal code",
        errorMessage: "Postal code must not be empty",
      },
      country: {
        label: "Country",
        errorMessage: "Country must not be empty",
        none: "Select country",
      },
      registerForNewsletter: {
        label: "Subscribe to newsletter",
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
    userReset: {
      submit: {
        text: "Reset password",
        loadingText: "Resetting password ...",
      }
    },
    checkout: {
      submit: {
        text: "Place binding order",
        loadingText: "Loading ...",
      },
      useShippingAsBilling: "Use shipping address as billing address",
    },
  },
  userConfirm: {
    submit: {
      text: "Confirm account",
      loadingText: "Confirming account ...",
    }
  },
  userOrders: {
    submit: {
      text: "Load orders",
      loadingText: "Loading orders ...",
    }
  },
  confirmUserExpired: {
    headline: 'Sorry!',
    text: 'The link you followed is invalid. Either you have already activated your account via this link, or the activation period has expired. To prevent misuse, we limit the validity of activation links for data protection reasons. However, you can request a new email with a valid activation link at any time.',
    action: 'Request email'
  },
  userRegistered: {
    text: 'If the email address provided is registered with us, you will shortly receive an email with which you can reset your password.'
  },
  userConfirmed: {
    text: 'Your account has been successfully activated. Enjoy shopping!'
  },
  userResetSuccess: {
    text: 'Your password has been successfully changed. Enjoy shopping!'
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
