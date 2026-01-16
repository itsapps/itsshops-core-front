import {emailRegex, passwordRegex, passwordRegexChecklist, requiredShippingAddressFields} from '../shared/validation.mjs';
import {
  errorPagePermalink,
  userLoginPermalink,
  userConfirmPermalink,
  userResetPermalink,
  userConfirmSuccessPermalink,
  userRecoverPermalink,
  userRecoverSuccessPermalink,
  userResetSuccessPermalink,
  userRegistrationPermalink,
  userRegistrationSuccessPermalink,
  orderThankYouPermalink,
  checkoutPermalink,
  userOrdersPermalink,
} from '../shared/urlPaths.mjs';

export function createStaticPages(locales, isDev, t) {
  const staticPages = {}

  const getErrorPagePermalink = (locale) => {
    return errorPagePermalink(locale)
  }
  staticPages.errorPages = locales.map(locale => {
    return {
      title: t('staticPages.errorPage.title', {}, locale),
      description: t('staticPages.errorPage.description', {}, locale),
      key: '404',
      locale: locale,
      permalink: getErrorPagePermalink(locale)
    }
  })

  const passwordValidationChecklistLocalized = Object.assign({}, ...locales.map(locale => {
    return {[locale]: [
      {
        name: "length",
        title: t('forms.fields.password.validationChecklist.length', {}, locale),
        regex: passwordRegexChecklist.length.toString(),
      },
      {
        name: "numbers",
        title: t('forms.fields.password.validationChecklist.numbers', {}, locale),
        regex: passwordRegexChecklist.numbers.toString(),
      },
      {
        name: "letters",
        title: t('forms.fields.password.validationChecklist.letters', {}, locale),
        regex: passwordRegexChecklist.letters.toString(),
      },
    ]}
  }));

  const getUserLoginFormPrefixed = (prefix, locale) => {
    return {
      id: prefix + "login-form",
      submit: {
        text: t('general.login', {}, locale),
        loadingText: t('general.loggingIn', {}, locale),
      },
      fields: [
        {
          id: prefix + "login-email",
          type: "email",
          name: "email",
          label: t('forms.fields.email.label', {}, locale),
          errorMessage: t('forms.fields.email.errorMessage', {}, locale),
          autocomplete: "username",
          required: true,
          autocapitalize: "none",
          autocorrect: "off",
          spellcheck: "false",
          pattern: emailRegex.toString(),
        },
        {
          id: prefix + "login-password",
          type: "password",
          name: "password",
          label: t('forms.fields.password.label', {}, locale),
          errorMessage: t('forms.fields.password.errorMessage', {}, locale),
          autocomplete: "current-password",
          required: true,
          pattern: passwordRegex.toString(),
        }
      ]
    }
  }
  staticPages.userLoginForms = Object.assign({}, ...locales.map(locale => {
    return {[locale]: getUserLoginFormPrefixed("sidebar-", locale)}
  }));

  staticPages.getUserLoginPermalink = (locale) => {
    return userLoginPermalink(locale, t)
  }
  staticPages.userLogins = locales.map(locale => {
    return {
      title: t('staticPages.userLogin.title', {}, locale),
      description: t('staticPages.userLogin.description', {}, locale),
      key: 'user_login',
      locale: locale,
      permalink: staticPages.getUserLoginPermalink(locale),
      form: getUserLoginFormPrefixed("", locale)
    }
  })

  staticPages.getUserRegistrationPermalink = (locale) => {
    return userRegistrationPermalink(locale, t)
  }
  staticPages.userRegistrations = locales.map(locale => {
    return {
      title: t('staticPages.userRegistration.title', {}, locale),
      description: t('staticPages.userRegistration.description', {}, locale),
      key: 'user_register',
      locale: locale,
      permalink: staticPages.getUserRegistrationPermalink(locale),
      form: {
        id: "registration-form",
        submit: {
          text: t('forms.userRegistration.submit.text', {}, locale),
          loadingText: t('forms.userRegistration.submit.loadingText', {}, locale),
        },
        fields: [
          {
            id: "register-email",
            type: "email",
            name: "email",
            label: t('forms.fields.email.label', {}, locale),
            errorMessage: t('forms.fields.email.errorMessage', {}, locale),
            autocomplete: "email",
            required: true,
            autocapitalize: "none",
            autocorrect: "off",
            spellcheck: "false",
            pattern: emailRegex.toString(),
          },
          {
            id: "register-password",
            type: "password",
            name: "password",
            label: t('forms.fields.password.label', {}, locale),
            errorMessage: t('forms.fields.password.errorMessage', {}, locale),
            autocomplete: "new-password",
            required: true,
            pattern: passwordRegex.toString(),
            validationChecklist: passwordValidationChecklistLocalized[locale],
          },
          {
            id: "register-newsletter",
            type: "checkbox",
            name: "registerForNewsletter",
            label: t('forms.fields.registerForNewsletter.label', {}, locale),
            inputFirst: true,
            inline: true,
            checked: true
          },
        ]
      }
    }
  })

  staticPages.getUserRegistrationSuccessPermalink = (locale) => {
    return userRegistrationSuccessPermalink(locale, t)
  }
  staticPages.userRegistrationSuccesses = locales.map(locale => {
    return {
      title: t('staticPages.userRegistrationSuccess.title', {}, locale),
      description: t('staticPages.userRegistrationSuccess.description', {}, locale),
      key: 'user_registered',
      locale: locale,
      permalink: staticPages.getUserRegistrationSuccessPermalink(locale),
    }
  })

  staticPages.getUserConfirmPermalink = (locale) => {
    return userConfirmPermalink(locale, t)
  }
  staticPages.userConfirms = locales.map(locale => {
    return {
      title: t('staticPages.userConfirm.title', {}, locale),
      description: t('staticPages.userConfirm.description', {}, locale),
      key: 'user_confirm',
      locale: locale,
      permalink: staticPages.getUserConfirmPermalink(locale)
    }
  })

  staticPages.getUserConfirmSuccessPermalink = (locale) => {
    return userConfirmSuccessPermalink(locale, t)
  }
  staticPages.userConfirmSuccesses = locales.map(locale => {
    return {
      title: t('staticPages.userConfirmSuccess.title', {}, locale),
      description: t('staticPages.userConfirmSuccess.description', {}, locale),
      key: 'user_confirmed',
      locale: locale,
      permalink: staticPages.getUserConfirmSuccessPermalink(locale)
    }
  })

  staticPages.getUserRecoverPermalink = (locale) => {
    return userRecoverPermalink(locale, t)
  }
  staticPages.userRecovers = locales.map(locale => {
    return {
      title: t('staticPages.userRecover.title', {}, locale),
      description: t('staticPages.userRecover.description', {}, locale),
      key: 'user_recover',
      locale: locale,
      permalink: staticPages.getUserRecoverPermalink(locale),
      form: {
        id: "recover-form",
        submit: {
          text: t('forms.userRecover.submit.text', {}, locale),
          loadingText: t('forms.userRecover.submit.loadingText', {}, locale),
        },
        fields: [
          {
            id: "recover-email",
            type: "email",
            name: "email",
            label: t('forms.fields.email.label', {}, locale),
            errorMessage: t('forms.fields.email.errorMessage', {}, locale),
            autocomplete: "username",
            required: true,
            autocapitalize: "none",
            autocorrect: "off",
            spellcheck: "false",
            pattern: emailRegex.toString(),
          }
        ]
      }
    }
  })

  staticPages.getUserRecoverSuccessPermalink = (locale) => {
    return userRecoverSuccessPermalink(locale, t)
  }
  staticPages.userRecoverSuccesses = locales.map(locale => {
    return {
      title: t('staticPages.userRecoverSuccess.title', {}, locale),
      description: t('staticPages.userRecoverSuccess.description', {}, locale),
      key: 'user_recovered',
      locale: locale,
      permalink: staticPages.getUserRecoverSuccessPermalink(locale),
    }
  })

  staticPages.getUserResetPermalink = (locale) => {
    return userResetPermalink(locale, t)
  }
  staticPages.userResets = locales.map(locale => {
    return {
      title: t('staticPages.userReset.title', {}, locale),
      description: t('staticPages.userReset.description', {}, locale),
      key: 'user_reset',
      locale: locale,
      permalink: staticPages.getUserResetPermalink(locale),
      form: {
        id: "reset-form",
        submit: {
          text: t('forms.userReset.submit.text', {}, locale),
          loadingText: t('forms.userReset.submit.loadingText', {}, locale),
        },
        fields: [
          {
            id: "reset-password",
            type: "password",
            name: "password",
            label: t('forms.fields.password.label', {}, locale),
            errorMessage: t('forms.fields.password.errorMessage', {}, locale),
            autocomplete: "new-password",
            required: true,
            pattern: passwordRegex.toString(),
            validationChecklist: passwordValidationChecklistLocalized[locale],
          },
        ]
      }
    }
  })

  staticPages.getUserResetSuccessPermalink = (locale) => {
    return userResetSuccessPermalink(locale, t)
  }
  staticPages.userResetSuccesses = locales.map(locale => {
    return {
      title: t('staticPages.userResetSuccess.title', {}, locale),
      description: t('staticPages.userResetSuccess.description', {}, locale),
      key: 'user_resetted',
      locale: locale,
      permalink: staticPages.getUserResetSuccessPermalink(locale),
    }
  })

  staticPages.getOrderThankYouPermalink = (locale) => {
    return orderThankYouPermalink(locale, t)
  }
  staticPages.orderThankYous = locales.map(locale => {
    return {
      title: t('staticPages.orderThankYou.title', {}, locale),
      description: t('staticPages.orderThankYou.description', {}, locale),
      key: 'order_thank_you',
      locale: locale,
      permalink: staticPages.getOrderThankYouPermalink(locale)
    }
  })


  staticPages.getCheckoutPermalink = (locale) => {
    return checkoutPermalink(locale, t)
  }
  staticPages.checkoutFieldsLocalized = Object.assign({}, ...locales.map(locale => {
    const addressFields = (prefix='') => {
      return [
        {
          group: true,
          gridClass: 'grid-2',
          fields: [
            {
              id: `checkout-${prefix}prename`,
              type: "text",
              name: prefix + "prename",
              label: t('forms.fields.prename.label', {}, locale),
              errorMessage: t('forms.fields.prename.errorMessage', {}, locale),
              required: requiredShippingAddressFields.includes('prename'),
              ...isDev && {value: "Tom"},
            },
            {
              id: `checkout-${prefix}lastname`,
              type: "text",
              name: prefix + "lastname",
              label: t('forms.fields.lastname.label', {}, locale),
              errorMessage: t('forms.fields.lastname.errorMessage', {}, locale),
              required: requiredShippingAddressFields.includes('lastname'),
              ...isDev && {value: "Devgarden"},
            },
          ]
        },
        {
          group: true,
          gridClass: 'grid-3-2',
          fields: [
            {
              id: `checkout-${prefix}street`,
              type: "text",
              name: prefix + "street",
              label: t('forms.fields.street.label', {}, locale),
              errorMessage: t('forms.fields.street.errorMessage', {}, locale),
              required: requiredShippingAddressFields.includes('street'),
              ...isDev && {value: "Blastrasse"},
            },
            {
              id: `checkout-${prefix}streetnumber`,
              type: "text",
              name: prefix + "streetnumber",
              label: t('forms.fields.streetnumber.label', {}, locale),
              errorMessage: t('forms.fields.streetnumber.errorMessage', {}, locale),
              required: requiredShippingAddressFields.includes('streetnumber'),
              ...isDev && {value: "14A"},
            },
          ]
        },
        {
          group: true,
          gridClass: 'grid-2-3',
          fields: [
            {
              id: `checkout-${prefix}zip`,
              type: "text",
              name: prefix + "zip",
              label: t('forms.fields.zip.label', {}, locale),
              errorMessage: t('forms.fields.zip.errorMessage', {}, locale),
              required: requiredShippingAddressFields.includes('zip'),
              ...isDev && {value: "6800"},
            },
            {
              id: `checkout-${prefix}city`,
              type: "text",
              name: prefix + "city",
              label: t('forms.fields.city.label', {}, locale),
              errorMessage: t('forms.fields.city.errorMessage', {}, locale),
              required: requiredShippingAddressFields.includes('city'),
              ...isDev && {value: "Feldkirch"},
            },
          ]
        },
        {
          group: true,
          gridClass: 'grid-2',
          fields: [
            {
              id: `checkout-${prefix}country`,
              type: "select",
              name: prefix + "country",
              label: t('forms.fields.country.label', {}, locale),
              errorMessage: t('forms.fields.country.errorMessage', {}, locale),
              required: requiredShippingAddressFields.includes('country'),
            }
          ]
        }
      ]
    }

    return {[locale]: [
      {
        title: t('checkout.sections.contact', {}, locale),
        fields: [
          {
            id: "checkout-email",
            type: "email",
            name: "email",
            label: t('forms.fields.email.label', {}, locale),
            errorMessage: t('forms.fields.email.errorMessage', {}, locale),
            autocomplete: "email",
            required: true,
            autocapitalize: "none",
            autocorrect: "off",
            spellcheck: "false",
            pattern: emailRegex.toString(),
            ...isDev && {value: "tut.ench.amok@gmail.com"},
          },
        ]
      },
      {
        title: t('checkout.sections.delivery', {}, locale),
        fields: addressFields()
      },
      {
        optional: {
          title: t('forms.checkout.useShippingAsBilling', {}, locale),
          group: "no-billing-address",
          requiredState: false,// if the check is checked, but requiredState is false, this means the fields with the same optionalRequiredGroup are not required
          initialState: true,//checked if true
          initiallyHidden: true,
        },
        fields: addressFields('billing_')
      },
      
    ]}
  }));
  staticPages.checkouts = locales.map(locale => {
    return {
      title: t('staticPages.checkout.title', {}, locale),
      description: t('staticPages.checkout.description', {}, locale),
      key: 'checkout',
      locale: locale,
      permalink: staticPages.getCheckoutPermalink(locale),
      form: {
        id: "checkout-form",
        submit: {
          text: t('forms.checkout.submit.text', {}, locale),
          loadingText: t('forms.checkout.submit.loadingText', {}, locale),
        },
        fields: [],
        fieldsets: staticPages.checkoutFieldsLocalized[locale],
        excludeButton: true,
        buttonExtraClasses: "is-block"
      }
    }
  })

  staticPages.getUserOrdersPermalink = (locale) => {
    return userOrdersPermalink(locale, t)
  }
  staticPages.userOrders = locales.map(locale => {
    return {
      title: t('staticPages.userOrders.title', {}, locale),
      description: t('staticPages.userOrders.description', {}, locale),
      key: 'user_orders',
      locale: locale,
      permalink: staticPages.getUserOrdersPermalink(locale)
    }
  })

  return staticPages
}
