import { ValidationError, IOError, ClientError, AuthError, GeneralError } from './browser-errors.ts';
import { showToast, smoothScrollIntoView } from './utils.ts';
import { JsonRequestResult } from './api.ts';

type ErrorHandler = (error: ClientError | ValidationError | IOError | AuthError | GeneralError, buttonId?: string) => void;


export const showServiceError = (error: IOError) => {
  const supportElement = document.getElementById('service-error');
  if (supportElement) {
    const a = supportElement.querySelector('a')!;
    a.href = a.href.replace(/(RequestId:)[^&]*/, `$1${error.requestId}`);
    const p = supportElement.querySelector('p[aria-live]');
    if (p) p.innerHTML = error.message || "";
    // supportElement.querySelector('span[id="service-error-request-id"]').innerHTML = error.requestId || "";

    supportElement.classList.remove('hidden');
    smoothScrollIntoView(supportElement, { block: 'nearest' });
  }
}

export const hideServiceError = () => {
  // hide support markup when loading/reloading
  const supportElement = document.getElementById('service-error');
  if (supportElement) {
    supportElement.classList.add('hidden');
  }
}

export const formHandler = async <
  T extends Record<string, any> = Record<string, any>
>(actionHandler: () => Promise<JsonRequestResult<T>>, {
  successHandler,
  errorHandler,
  replaceRedirect=false,
}: {
  successHandler?: (data: T) => void;
  errorHandler?: ErrorHandler;
  replaceRedirect?: boolean;
} = {}) => {
  hideServiceError();

  const {success, data} = await actionHandler();

  // immediate redirect if success or error have a redirectUrl returned
  const doRedirect = handleRedirect(data, {
    replaceRedirect
  });
  if (success) {
    successHandler && successHandler(data)
    if (doRedirect) {
      doRedirect();
    }
    return {};
  } else {
    if (data instanceof ClientError || data instanceof ValidationError || data instanceof GeneralError) {
      showToast(data.message, 30*1000);
    }
    if (data instanceof IOError) {
      showServiceError(data);
    }
    if (data instanceof AuthError) {
      showToast(data.message, -1);
    }

    errorHandler && errorHandler(data)
    if (doRedirect) {
      doRedirect();
    }
    
    return {
      ...data.meta.fields && {errorFields: data.meta.fields}
    }
  }
  
  // if (error instanceof ClientError) {
  //   showToast(error.message, 5000);
  // }
  // if (error instanceof IOError) {
  //   handleServiceError(error);
  // }
  // if (data instanceof AuthError) {
  //   showToast(data.message, -1);
  // }
  // return {
  //   ...error.meta.fields && {errorFields: error.meta.fields}
  // }
}

type RedirectData = {
  redirectUrl?: string;
  meta?: {
    redirectUrl?: string;
  }
}
type RedirectResult = (() => void) | null

const redirect = (url: string, replaceLocation: boolean) => {
  return () => {
    if (replaceLocation) {
      window.location.replace(url);
    } else {
      window.location.href = url
    }
  }
}
const handleRedirect = (data: RedirectData, {
  replaceRedirect=false,
}: {
  replaceRedirect?: boolean;
}): RedirectResult => {
  const redirectUrl = data.redirectUrl || data.meta?.redirectUrl;
  // success or error have a redirectUrl
  if (redirectUrl) {
    return redirect(redirectUrl, replaceRedirect)
  }
  return null
}

export const retryHandler = <
  T extends Record<string, any> = Record<string, any>
>(actionHandler: () => Promise<JsonRequestResult<T>>, {
  successHandler,
  errorHandler,
  completionHandler,
  replaceRedirect=false,
  removeRetryButtonOnSuccess=false,
  buttonId='retry-button',
}: {
  successHandler?: (data: T, buttonId?: string) => (() => void | Promise<void>) | void;
  errorHandler?: ErrorHandler;
  completionHandler?: (success: boolean, willRedirect: boolean) => void;
  replaceRedirect?: boolean;
  removeRetryButtonOnSuccess?: boolean;
  buttonId?: string;
} = {}) => {
  // const resolveElement = document.getElementById('resolve-button');
  const retryElement: HTMLButtonElement = document.getElementById(buttonId) as HTMLButtonElement;
  let isSubmitting = false;

  const buttonClickHandler = async () => {
    await doAction();
  }
  if (retryElement) {
    retryElement.addEventListener('click', buttonClickHandler)
  }

  const setLoading = (isLoading: boolean) => {
    isSubmitting = isLoading;
    if (retryElement) {
      retryElement.dataset.loading = isLoading ? 'true' : 'false';
      retryElement.disabled = isLoading;
    }
  }

  const doAction = async () => {
    if (isSubmitting) return;

    hideServiceError();
    
    setLoading(true);
    const {success, data} = await actionHandler();

    // immediate redirect if success or error have a redirectUrl returned
    const doRedirect = handleRedirect(data, {
      replaceRedirect
    });
    
    setLoading(false);

    if (success) {
      if (removeRetryButtonOnSuccess) {
        const retryButtonContainer = document.getElementById(buttonId + '-container');
        if (retryButtonContainer) {
          retryButtonContainer.remove();
        }
        else if (retryElement) {
          retryElement.remove();
        }
      }
      successHandler && successHandler(data, buttonId);
    } else {
      if (
        data instanceof ClientError ||
        data instanceof ValidationError ||
        data instanceof AuthError ||
        data instanceof GeneralError
      ) {
        showToast(data.message, 30*1000);
      }
      else if (data instanceof IOError) {
        showServiceError(data);
      }

      errorHandler && errorHandler(data, buttonId)
    }

    completionHandler && completionHandler(success, !!doRedirect);

    if (doRedirect) {
      doRedirect();
    }
  }

  return {
    doAction
  }
}