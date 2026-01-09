export default {
  home: {
    welcome: "Welcome",
    welcomeText: "... bei Fliegenfischen mit Herz",
  },
  navigation: {
    search: "Search",
    toggleSearchAria: "Toggle Search",
    goHome: "Go Home",
  },
  general: {
    retry: "Retry",
    back: 'Back',
    skipText: 'Jump to main content',
    toc: 'Table of contents',
    skipToc: 'Skip table of contents',
    isLoading: 'Loading',
    registerNew: 'Register here',
    register: 'Register',
    loginHeadline: 'Login',
    closeLogin: 'Close Login',
    login: 'Login',
    logout: 'Logout',
    loggingIn: 'Login ...',
    loggingOut: 'Logout ...',
    goToLogin: '',
    forgotPassword: 'Forgotten your password?',
    areYouNew: 'Are you new here?',
    serviceError: {
      title: 'Service Error',
      contactSupport: 'Send email to support',
    },
  },
  customerCenter: {
    title: "Customer Centre",
    ariaCloseCustomerCenter: "Close Customer Centre",
    yourOrders: "Your Orders",
  },
  search: {
    products: "Products",
    categories: "Categories",
    manufacturers: "Manufacturers",
    closeSearchAria: "Close Search",
    retrySearchAria: "Retry loading Search",
    inputPlaceholder: "Search Products",
  },
  menus: {
    main: {
      label: "Main Menu",
      ariaLabel: "Main",
      open: "Open Menu",
      close: "Close Menu",
      all: "All",
    },
    footer: {
      ariaLabel: "Footer"
    },
    language: {
      select: "Select language",
      change: "Change language"
    }
  },
  footer: {
    contact: "Contact",
  },
  user: {
  },
  cart: {
    menu: "Bag",
    cart: "Cart",
    open: "Go to Cart",
    close: "Close Cart",
    empty: "Your Cart is empty.",
    ariaQuantity: "Quantity",
    ariaRemoveProduct: "Remove from Cart",
    removeProduct: "Remove",
    subtotal: "Subtotal",
    tax: "Included Tax",
    shipping: "Shipping",
    discount: "Discount",
    total: "Total",
    toCheckout: "Checkout",
    itemsChanged: "Cart has changed",
    productRemoved: "Product not listed anymore",
    ariaRemoveVoucher: "Remove Voucher",
    ariaEnableVoucher: "Activate Voucher",
    ariaDisableVoucher: "Deactivate Voucher",
    vouchers: "Vouchers",
    addVoucher: "Add Voucher",
    addVoucherLoading: "Adding Voucher...",
    counter: {
      decreaseQuantity: "Decrease quantity by one",
      increaseQuantity: "Increase quantity by one",
      manuallySetQuantity: "Manually enter quantity",
    },
  },
  orders: {
    empty: "You have no orders yet.",
    detailsHeader: "Order details",
    orderNumber: "Order number",
    orderDate: "Date",
    orderStatus: "Status",
  },
  checkout: {
    sections: {
      contact: "Contact",
      delivery: "Delivery",
      payment: "Payment",
      shippingMethod: "Shipping method",
    },
    voucherPlaceholder: "Enter voucher code",
  },
  product: {
    description: "Description",
    allProducts: "All Products",
    randomProducts: "Random products",
    relatedProducts: "Related products",
    otherProducts: "Other products",
    categories: "Categories",
    cartButton: {
      addToCart: "Add to cart",
      addedToCart: "Added to cart",
      addToCartShort: "Add",
      addedToCartShort: "Added",
    },
    stock: "Availability",
    shippingDuration: "Shipping duration: 2-3 business days"
  },
  products: {
    loop: {
      ariaLabel: "Products",
    },
  },
  categories: {
    subCategories: {
      ariaLabel: "Subcategories",
    },
    products: "Products",
  },
  dynamicPages: {
    products: {
      path: "products"
    },
    categories: {
      path: "categories"
    },
    blogPosts: {
      path: "blog",
      title: "Blog",
      page: "page",
      pagination: {
        page: "Page {{page}}",
      },
    },
    blogPost: {
      path: "blog"
    },
  },
  staticPages: {
    errorPage: {
      title: "I'm unable to find this page!",
      description: "404 - I'm unable to find this page! Please try to visit the home page. Please let me know if you encounter more errors!",
      goToHomepage: "Try to visit the <a href='/{{ url }}/'>home page!</a>",
      contactSupport: "Please let me know if there are any other errors so I can correct them: <a href='mailto:{{ email }}'>{{ email }}</a>"
    },
    userLogin: {
      title: "Login",
      description: "Login User",
    },
    userRegistration: {
      title: "Registration",
      description: "Register User",
      info: "Once you have registered, we will send you an e-mail with a link you can use to activate your account.",
    },
    userRegistrationSuccess: {
      title: "Thank You!",
      description: "Thanks for registering",
      info: "You will receive your login details shortly by email. In the meantime, you can place an order with us online - the ordering process does not require a login!"
    },
    userConfirm: {
      title: "Account Confirmation",
      description: "Confirmation of Account",
    },
    userConfirmSuccess: {
      title: "Welcome!",
      description: "Account confirmed successfully",
    },
    userRecover: {
      title: "Reset Password",
      description: "Reset Password of your account",
      info: "Please enter the email address you used to register with us. We will send you a link which you can use to set a new password."
    },
    userRecoverSuccess: {
      title: "Password reset",
      description: "Password was reset successfully",
    },
    userReset: {
      title: "Change Password",
      description: "Change Password",
    },
    userResetSuccess: {
      title: "Great!",
      description: "Successfully changed Password",
    },
    userOrders: {
      title: "Orders",
      description: "Your Orders",
    },
    orderThankYou: {
      title: "Thanks",
      description: "Thanks for the Order",
      text: "Your order has been successfully placed and will be processed as soon as possible.",
      submit: {
        text: "Load Order",
        loadingText: "Order loading ...",
      },
    },
    checkout: {
      title: "Order",
      description: "Pay Order",
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
        errorMessage: "The Password must contain at least one number, one uppercase and lowercase letter, and at least 8 or more characters",
        validationChecklist: {
          numbers: "At least one number",
          length: "8 characters or more",
          letters: "Uppercase and lowercase letters"
        }
      },
      prename: {
        label: "First Name",
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
        label: "House Number",
        errorMessage: "House number must not be empty",
      },
      city: {
        label: "Place/City",
        errorMessage: "Place/City must not be empty",
      },
      zip: {
        label: "Postcode/ZIP",
        errorMessage: "Postcode/ZIP must not be empty",
      },
      country: {
        label: "Country",
        errorMessage: "Country must not be empty",
        none: "Choose country",
      },
      registerForNewsletter: {
        label: "Register for newsletter",
      }
    },
    userRegistration: {
      submit: {
        text: "Register",
        loadingText: "Registering ...",
      }
    },
    userRecover: {
      submit: {
        text: "Send new password",
        loadingText: "Laden ...",
      }
    },
    userReset: {
      submit: {
        text: "Reset password",
        loadingText: "Resetting ...",
      }
    },
    checkout: {
      submit: {
        text: "Place order",
        loadingText: "Placing order ...",
      },
      useShippingAsBilling: "Use shipping address as billing address",
    },
  },
  userConfirm: {
    submit: {
      text: "Confirm Account",
      loadingText: "Confirming Account ...",
    }
  },
  userOrders: {
    submit: {
      text: "Load Orders",
      loadingText: "Orders loading ...",
    }
  },
  confirmUserExpired: {
    headline: 'Sorry!',
    text: 'The link you clicked is invalid. Either you have already activated your customer account using this link, or the activation period for this link has expired. To prevent misuse, we limit the validity of activation links for data protection reasons. However, you can request a new email with a valid activation link at any time.',
    action: 'Request Email'
  },
  userRegistered: {
    text: 'If your email address is saved with us, you will shortly receive an email with which you can reset your password.'
  },
  userConfirmed: {
    text: 'Your customer account has been successfully activated. Have fun shopping!'
  },
  userResetSuccess: {
    text: 'Your password has been successfully updated. Have fun shopping!'
  },
  cookies: {
    title: "Cookie Consent",
    close: "Close",
    description: "We use cookies to enhance your browsing experience, serve personalized ads or content, and analyze our traffic. By clicking \"Accept All\", you consent to our use of cookies. You can manage your preferences below.",
    privacyPolicy: "Privacy Policy",
    essential: {
      title: "Essential Cookies",
      required: "Required",
      description: "These cookies are necessary for the website to function properly and cannot be disabled.",
      accessToken: "Stores your authentication token for secure login",
      refreshToken: "Refreshes your authentication to keep you logged in",
      cart: "Maintains your shopping cart across sessions",
      stripe: "Required for secure payment processing",
    },
    analytics: {
      title: "Analytics Cookies",
      description: "We use Google Analytics to analyze how you use our website and to improve it. The data collected is processed anonymously. You can choose to accept or reject Analytics cookies. For more information, see our {{ privacyPolicy }}.",
      cookiePolicy: "Cookie Policy",
    },
    marketing: {
      title: "Marketing Cookies",
      description: "These cookies allow us to show you personalized ads and track marketing campaign performance. You can disable these without affecting website functionality.",
    },
    actions: {
      rejectAll: "Reject All",
      acceptAll: "Accept All",
      savePreferences: "Save Preferences",
      settings: "Settings",
    },
    editButton: "Cookies",
    settings: {
      title: "Cookie Settings",
    }
  },
};
